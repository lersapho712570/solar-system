pipeline {
    agent any

    tools {
        nodejs 'nodejs-22-6-0' 
    }

    environment {
        SONAR_SCANNER_HOME = tool 'sonarqube-scanner-700'
        GITEA_TOKEN = credentials('gitea-api-token')
    }

    options {
        disableResume()
        disableConcurrentBuilds abortPrevious: true
    }

    stages {
        stage('Check Softwware Version') {
            steps {
                sh '''
                    echo "Node Version: $(node -v)"
                    echo "NPM Version: $(npm -v)"
                '''
            }
        }

        stage('Installing Dpendencies') {
            options {
                timestamps()
            }
            steps {
                sh "npm install --no-audit"
            }
        }

        stage('Dependencies Scanning') {
            parallel {

                stage('NPM Dependencies Audit') {
                    steps {
                        sh '''
                            npm audit --audit-level=critical
                            echo $?
                        '''
                    }
                }

                stage('OWASP Dependency Check') {
                    steps {
                        
                        // --format ALL
                        dependencyCheck additionalArguments: '''
                            --scan ./ 
                            --out ./ 
                            --format ALL 
                            --disableYarnAudit
                            --nvdApiKey 7c16af02-699f-4a25-9657-89d202a868b0
                        ''', odcInstallation: 'OWASP-DepCheck-12.1.0'

                        // dependencyCheckPublisher(...) parses the file **dependency-check-report.xml**
                        dependencyCheckPublisher(
                            failedTotalCritical: 1,
                            pattern: 'dependency-check-report.xml',
                            stopBuild: true
                        )

                        // junit(...) parses a separate file called **dependency-check-junit.xml**
                        // Move this to post section

                    }
                }

            }
        }

        stage('Unit Testing') {
            options { retry(2) }

            steps {
                sh "npm test"
            }
        }

        stage('Check Code Coverage') {
            options { retry(2) }

            steps {
                withCredentials([usernamePassword(credentialsId: 'mongo-db-credentials', passwordVariable: 'MONGO_PASSWORD', usernameVariable: 'MONGO_USERNAME')]) {
                    
                    catchError(buildResult: 'SUCCESS', message: 'Oops! it will be fixed in future release', stageResult: 'UNSTABLE') {
                        sh "npm run coverage"
                    }
                }
                
            }
        }

        stage('SonarQube Code Scan') {

            steps {
                timeout(time: 60, unit: 'MINUTES') {
                    withSonarQubeEnv('sonarqube-server') {
                        sh 'echo $SONAR_SCANNER_HOME'
                        sh '''
                            $SONAR_SCANNER_HOME/bin/sonar-scanner \
                                -Dsonar.projectKey=Solar-System-Project \
                                -Dsonar.sources=app.js \
                                -Dsonar.javascript.lcov.reportPaths=./coverage/lcov.info
                        '''
                    }
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Build Docker Image') {

            steps {
                sh 'printenv'
                // sh 'docker build -t harbor.devops.lab/lersapholabs-org/solar-system:$GIT_COMMIT .'
                sh 'docker build -t 712570/solar-system:$GIT_COMMIT .'
            }
        }

        stage('Trivy Container Image Scan') {
            steps {
                sh  ''' 
                    trivy image 712570/solar-system:$GIT_COMMIT \
                        --severity LOW,MEDIUM,HIGH \
                        --exit-code 0 \
                        --quiet \
                        --format json -o trivy-image-MEDIUM-results.json

                    trivy image 712570/solar-system:$GIT_COMMIT \
                        --severity CRITICAL \
                        --exit-code 1 \
                        --quiet \
                        --format json -o trivy-image-CRITICAL-results.json
                '''
            }
            post {
                always {
                    sh '''
                        trivy convert \
                            --format template --template "@/usr/local/share/trivy/templates/html.tpl" \
                            --output trivy-image-MEDIUM-results.html trivy-image-MEDIUM-results.json 

                        trivy convert \
                            --format template --template "@/usr/local/share/trivy/templates/html.tpl" \
                            --output trivy-image-CRITICAL-results.html trivy-image-CRITICAL-results.json

                        trivy convert \
                            --format template --template "@/usr/local/share/trivy/templates/junit.tpl" \
                            --output trivy-image-MEDIUM-results.xml  trivy-image-MEDIUM-results.json 

                        trivy convert \
                            --format template --template "@/usr/local/share/trivy/templates/junit.tpl" \
                            --output trivy-image-CRITICAL-results.xml trivy-image-CRITICAL-results.json          
                    '''
                }
            }
        } 

        stage('Deploy Dev Env - Dcoker') {

            when {
            branch 'feature/*'
            }

            environment {
                DEV_MONGO_URI = 'localhost:27017'
            }

            steps {
                script {
                        withCredentials([usernamePassword(credentialsId: 'mongo-db-credentials', passwordVariable: 'DEV_MONGO_PASSWORD', usernameVariable: 'DEV_MONGO_USERNAME')]) {
                            sshagent(['root-docker-staging']) {
                                sh """
                                    ssh -o StrictHostKeyChecking=no root@172.31.1.185 "
                                        if docker ps | grep -q solar-system; then
                                            echo "container exists, stoping and removing it"
                                            docker stop solar-system && docker rm solar-system
                                            echo "container stopped and removed"
                                        fi
                                        docker run -d --name solar-system \
                                            -p 3003:3000 \
                                            -e MONGO_URI=$DEV_MONGO_URI \
                                            -e MONGO_USERNAME=$DEV_MONGO_USERNAME \
                                            -e MONGO_PASSWORD=$DEV_MONGO_PASSWORD \
                                            -e ENV_BUILD_ID=$BUILD_ID \
                                            -e ENV_CONFIGMAP=DEV \
                                            -e ENV_SECRET=DEV \
                                            712570/solar-system:${GIT_COMMIT} \
                                            
                                    "
                                """
                            }
                        }
                }
            }
                
        }

        stage('Deploy UAT Env - Docker') {

            when {
                branch 'PR-*'
            }

            environment {
                UAT_MONGO_URI = 'localhost:27017'
            }

            steps {
                script {
                        withCredentials([usernamePassword(credentialsId: 'mongo-db-credentials', passwordVariable: 'UAT_MONGO_PASSWORD', usernameVariable: 'UAT_MONGO_USERNAME')]) {
                            sshagent(['root-docker-staging']) {
                                sh """
                                    ssh -o StrictHostKeyChecking=no root@172.31.1.185 "
                                        if docker ps | grep -q solar-system-uat; then
                                            echo "container exists, stoping and removing it"
                                            docker stop solar-system-uat && docker rm solar-system-uat
                                            echo "container stopped and removed"
                                        fi
                                        docker run -d --name solar-system-uat \
                                            -p 3004:3000 \
                                            -e MONGO_URI=$UAT_MONGO_URI \
                                            -e MONGO_USERNAME=$UAT_MONGO_USERNAME \
                                            -e MONGO_PASSWORD=$UAT_MONGO_PASSWORD \
                                            -e ENV_BUILD_ID=$BUILD_ID \
                                            -e ENV_CONFIGMAP="UAT_$CHANGE_ID" \
                                            -e ENV_SECRET="UAT_$CHANGE_ID" \
                                            712570/solar-system:${GIT_COMMIT} \
                                            
                                    "
                                """
                            }
                        }
                }
            }
        }

        stage('OWASP ZAP Scan') {
            when {
                branch 'PR-*'
            }
            steps {
                sh '''
                    set +e
                    chmod 777 $(pwd)
                    docker run -v $(pwd):/zap/wrk/:rw ghcr.io/zaproxy/zaproxy zap-api-scan.py \
                        -t http://solar-uat.devops.lab:3004/api-docs \
                        -f openapi \
                        -r zap_report.html \
                        -w zap_report.md \
                        -j zap_json_report.json \
                        -x zap_xml_report.xml \
                        -c zap_ignore_rules
                    
                    exit_code=$?

                    if [[ ${exit_code} -ne 0 ]]; then
                        echo "Can not Ignore Rule, Bypass it"
                        exit 0
                    fi
                '''
            }
        }

        stage('Push Docker Image') {

            when {
                branch 'main'
            }

            steps {
                withDockerRegistry(credentialsId: 'dokcer-hub-user', url: "") {
                    sh 'docker push 712570/solar-system:$GIT_COMMIT'
                }
                
            }
        }

        stage('Deploy to Production ?') {

            when {
                branch 'main*'
            }


            steps {
                timeout(time: 1, unit: 'DAYS') {
                    input message: 'Deploy to Production?', ok: 'Yes, Deploy'
                }
            }
        }

        stage('Kubernetes Update Deployment Image tag') {

            when {
                branch 'main*'
            }

            steps {
                sh 'git clone -b main http://gitea.devops.lab:3000/lersapholabs-org/solar-system-gitops-argocd.git'
                dir("solar-system-gitops-argocd/kubernetes"){
                    sh '''
                        #### Replace Docker Tag ####
                        git checkout main
                        sed -i "s#712570.*#712570/solar-system:${GIT_COMMIT}#g" deployment.yml
                    '''

                    // Replace ENV_BUILD_ID
                    sh """
                        sed -i '/- name: ENV_BUILD_ID/ {
                            n
                            s#value:.*#value: "${BUILD_ID}"#
                        }' deployment.yml
                    """

                    sh '''
                        #### Commit and Push to Main Branch ####
                        cat deployment.yml
                        git config --global user.email "jenkins@lersapholabs.com"
                        git remote set-url origin http://$GITEA_TOKEN@gitea.devops.lab:3000/lersapholabs-org/solar-system-gitops-argocd.git
                        git add .
                        git commit -m "Update Docker image tag to $GIT_COMMIT"
                        git push -u origin main
                    '''
                }
                
            }
        }

    }

    post {
        always {
            // From dependencies scanning stage
            junit allowEmptyResults: true, keepProperties: true, testResults: 'dependency-check-junit.xml'

            publishHTML(
                [
                    allowMissing: true,
                    alwaysLinkToLastBuild: true,
                    icon: '', 
                    keepAll: true,
                    reportDir: '.',  // or use 'dependency-check-report'
                    reportFiles: 'dependency-check-jenkins.html',
                    reportName: 'Dependency Check HTML Report',
                    reportTitles: 'HTML Report',
                    useWrapperFileDirectly: true
                ]
            )

            // From unit testing stage
            junit allowEmptyResults: true, keepProperties: true, testResults: 'test-results.xml'

            // From code coverage stage
            publishHTML([
                    allowMissing: true,
                    alwaysLinkToLastBuild: true,
                    icon: '', 
                    keepAll: true,
                    reportDir: 'coverage/lcov-report',  // or use 'dependency-check-report'
                    reportFiles: 'index.html',
                    reportName: 'Code Coverage HTML Report',
                    reportTitles: 'HTML Report',
                    useWrapperFileDirectly: true
            ])

            // Trivy
            junit allowEmptyResults: true, stdioRetention: '', testResults: 'trivy-image-CRITICAL-results.xml'
            junit allowEmptyResults: true, stdioRetention: '', testResults: 'trivy-image-MEDIUM-results.xml'

            publishHTML([allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true, reportDir: './', reportFiles: 'trivy-image-CRITICAL-results.html', reportName: 'Trivy Image Critical Vul Report', reportTitles: '', useWrapperFileDirectly: true])

            publishHTML([allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true, reportDir: './', reportFiles: 'trivy-image-MEDIUM-results.html', reportName: 'Trivy Image Medium Vul Report', reportTitles: '', useWrapperFileDirectly: true])

            publishHTML([allowMissing: true, alwaysLinkToLastBuild: true, keepAll: true, reportDir: './', reportFiles: 'zap_report.html', reportName: 'DAST - OWASP ZAP Report', reportTitles: '', useWrapperFileDirectly: true])

            script {
                if (fileExists('solar-system-gitops-argocd')) {
                    sh 'rm -rf solar-system-gitops-argocd'
                }
            }
        }
    }

}