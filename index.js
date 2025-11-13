const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const { ObjectId } = require("mongodb");
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());
//mongodb
const uri = process.env.MONGODB_URL;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server    (optional starting in v4.7)
    await client.connect();

    //connect to the collection
    const db = client.db("bill_db");
    const billCollection = db.collection("bills");
    const paidCollection = db.collection("paid_bills");
    // all the routes
    // Get all bills
    app.get("/bills", async (req, res) => {
      try {
        const { category, limit } = req.query;
        const count = await billCollection.countDocuments();
        const total = parseInt(limit) || count;
        // Build query object dynamically
        const query = {};
        if (category) {
          query.category = category; // only filter by category if provided
        }
        const cursor = billCollection.find(query).limit(total);
        const result = await cursor.toArray();
        res.status(200).send(result);
      } catch (error) {
        console.error("Error fetching bills:", error);
        res.status(500).send("Internal Server Error");
      }
    });
    app.get("/bills/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const bill = await billCollection.findOne(query);

        if (!bill) {
          return res.status(404).send({ message: "Bill not found" });
        }

        res.send(bill);
      } catch (error) {
        console.error("Error fetching bill:", error);
        res.status(500).send("Internal Server Error");
      }
    });
    app.get("/payment", async (req, res) => {
      try {
        const query = {};
        const cursor = paidCollection.find(query);
        const result = await cursor.toArray();
        res.status(200).send(result);
      } catch (error) {
        console.error("Error fetching payments:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.post("/payment", async (req, res) => {
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

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});
