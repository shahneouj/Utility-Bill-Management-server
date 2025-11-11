const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Movie Master Pro Server is running");
});
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

    // all the routes
    app.get("/bills", async (req, res) => {
      try {
        const query = {};
        const cursor = billCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching bills:", error);
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
