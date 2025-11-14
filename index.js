// api/index.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const { ObjectId } = require("mongodb");
const { MongoClient, ServerApiVersion } = require("mongodb");
const admin = require("firebase-admin");

// ---------- Firebase ----------
let firebaseApp;
if (!admin.apps.length) {
  const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
    "utf8",
  );
  const serviceAccount = JSON.parse(decoded);
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else {
  firebaseApp = admin.app();
}

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());

// ---------- Token validation ----------
const validationToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  try {
    const decoded = await firebaseApp.auth().verifyIdToken(token);
    req.token_email = decoded.email;
    next();
  } catch (error) {
    console.error("Token verification error:", error.message);
    return res.status(401).send({ message: "unauthorized access" });
  }
};

// ---------- MongoDB (cached connection) ----------
const uri = process.env.MONGODB_URL;
if (!uri) throw new Error("MONGODB_URL is missing");

let client;
let clientPromise;

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });
  clientPromise = client.connect();
}

// ---------- Collections (will be set after connection) ----------
let billCollection, paidCollection, userCollection;

// ---------- Connect once ----------
async function run() {
  await clientPromise; // now defined!
  const db = client.db("bill_db");
  billCollection = db.collection("bills");
  paidCollection = db.collection("paid_bills");
  userCollection = db.collection("users");
}
run();
app.get("/", (req, res) => {
  res.send(" Server is running");
});
// ---------------------------------------------------------------------
// ALL ROUTES BELOW (outside run(), using billCollection etc.)
// ---------------------------------------------------------------------

app.get("/bills", async (req, res) => {
  try {
    const { category, limit } = req.query;
    const count = await billCollection.countDocuments();
    const total = parseInt(limit) || count;
    const query = {};
    if (category) query.category = category;
    const cursor = billCollection.find(query).limit(total);
    const result = await cursor.toArray();
    res.status(200).send(result);
  } catch (error) {
    console.error("Error fetching bills:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/bills/:id", validationToken, async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const bill = await billCollection.findOne(query);
    if (!bill) return res.status(404).send({ message: "Bill not found" });
    res.send(bill);
  } catch (error) {
    console.error("Error fetching bill:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/payment", validationToken, async (req, res) => {
  try {
    const query = { email: req.token_email };
    const cursor = paidCollection.find(query);
    const result = await cursor.toArray();
    res.status(200).send(result);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/payment", validationToken, async (req, res) => {
  try {
    const bill = req.body;
    const result = await paidCollection.insertOne(bill);
    res.status(201).send(result);
  } catch (error) {
    console.error("Error creating bill:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.patch("/payment/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const bill = req.body;
    const query = { _id: new ObjectId(id) };
    const result = await paidCollection.updateOne(query, { $set: bill });
    res.status(200).send(result);
  } catch (error) {
    console.error("Error updating bill:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.delete("/payment/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await paidCollection.deleteOne(query);
    res.status(200).send(result);
  } catch (error) {
    console.error("Error deleting bill:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/user", async (req, res) => {
  try {
    const user = req.body;
    const email = req.body.email;
    if (!email) return res.status(400).send({ message: "Email is required" });
    const query = { email };
    const existingUser = await userCollection.findOne(query);
    if (existingUser) {
      return res.send({
        message: "User already exists. Do not need to insert again",
      });
    }
    const result = await userCollection.insertOne(user);
    res.status(201).send(result);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).send("Internal Server Error");
  }
});

// ---------------------------------------------------------------------
// Vercel Export (MUST await clientPromise)
// ---------------------------------------------------------------------
module.exports = async (req, res) => {
  await clientPromise; // now defined and works
  app(req, res);
};
