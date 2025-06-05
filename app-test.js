// app-test.js
const sinon = require("sinon");

// ─── 0) Ensure NODE_ENV is set to "test" so /os returns an "env" key ─────────────────
process.env.NODE_ENV = "test";

const mongoose = require("mongoose");
const chai = require("chai");
const chaiHttp = require("chai-http");

chai.should();
chai.use(chaiHttp);

// ─── 1) Stub mongoose.connect() so no real MongoDB connection is attempted ─────────
sinon.stub(mongoose, "connect").resolves();

// ─── 2) Require the application AFTER stubbing mongoose.connect() ───────────────────
const server = require("./app");

// ─── 3) After ALL tests, restore mongoose.connect ──────────────────────────────────
after(() => {
  mongoose.connect.restore();
});

describe("Application Endpoints", () => {
  //
  // GET /
  //
  describe("GET / (root)", () => {
    it("should return HTML (status 200) or a 500 error if index.html is missing", (done) => {
      chai
        .request(server)
        .get("/")
        .end((err, res) => {
          if (res.status === 200) {
            // index.html existed: verify HTML
            res.text.should.be.a("string");
            res.text.toLowerCase().should.contain("<html>");
            return done();
          }
          // index.html missing: verify 500 + "error"
          res.should.have.status(500);
          res.text.toLowerCase().should.contain("error");
          done();
        });
    });
  });

  //
  // GET /api-docs
  //
  describe("GET /api-docs", () => {
    it("should return 200 with JSON (if oas.json exists) or 500 error (if missing)", (done) => {
      chai
        .request(server)
        .get("/api-docs")
        .end((err, res) => {
          if (res.status === 200) {
            // oas.json existed: verify JSON body
            res.body.should.be.an("object");
            return done();
          }
          // oas.json missing: verify 500 + "error"
          res.should.have.status(500);
          res.text.toLowerCase().should.contain("error");
          done();
        });
    });
  });

  //
  // GET /os
  //
  describe("GET /os", () => {
    it("should return JSON with 'os' and 'env' keys", (done) => {
      chai
        .request(server)
        .get("/os")
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.be.an("object");
          res.body.should.have.property("os");
          res.body.should.have.property("env", "test");
          done();
        });
    });
  });

  //
  // GET /live
  //
  describe("GET /live", () => {
    it("should return { status: 'live' }", (done) => {
      chai
        .request(server)
        .get("/live")
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.have.property("status", "live");
          done();
        });
    });
  });

  //
  // GET /ready
  //
  describe("GET /ready", () => {
    it("should return { status: 'ready' }", (done) => {
      chai
        .request(server)
        .get("/ready")
        .end((err, res) => {
          res.should.have.status(200);
          res.body.should.have.property("status", "ready");
          done();
        });
    });
  });

  //
  // POST /planet
  //
  describe("POST /planet", () => {
    let findOneStub;
    let planetModel;

    before(() => {
      // Grab the 'planets' model defined in app.js
      planetModel = mongoose.model("planets");
      // Stub planetModel.findOne() for our tests
      findOneStub = sinon.stub(planetModel, "findOne");
    });

    after(() => {
      findOneStub.restore();
    });

    it("should return planet data when findOne yields a document", (done) => {
      const fakeDoc = { name: "Earth", id: 3, description: "Blue planet" };
      findOneStub.yields(null, fakeDoc);

      chai
        .request(server)
        .post("/planet")
        .send({ id: 3 })
        .end((err, res) => {
          res.should.have.status(200);
          // Express `res.send(fakeDoc)` serializes JSON automatically
          res.body.should.deep.equal(fakeDoc);
          done();
        });
    });

    it("should return 'Error in Planet Data' when findOne yields an error", (done) => {
      findOneStub.yields(new Error("DB failure"), null);

      chai
        .request(server)
        .post("/planet")
        .send({ id: 999 })
        .end((err, res) => {
          res.should.have.status(200);
          res.text.should.equal("Error in Planet Data");
          done();
        });
    });
  });
});
