const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");

app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.nsfvh.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};

const run = async () => {
  try {
    await client.connect();
    //tools collection
    const toolsCollection = client.db("toptool").collection("tools");
    const usersCollection = client.db("toptool").collection("users");
    const orderCollection = client.db("toptool").collection("orders");

    //get all tools
    app.get("/tools", async (req, res) => {
      const tools = await toolsCollection.find({}).toArray();
      res.send(tools);
    });
    //get tool by id
    app.get("/tool/:id", verifyJWT, async (req, res) => {
      const tool = await toolsCollection.findOne({
        _id: ObjectId(req.params.id),
      });
      res.send(tool);
    });

    //update or add a user
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updatedDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ result, token });
    });

    //get all orders
    app.get("/orders", verifyJWT, async (req, res) => {
      const orders = await orderCollection.find({}).toArray();
      res.send(orders);
    });
    //post a order
    app.post("/order", verifyJWT, async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      res.send(result);
    });
    //get order by email
    app.get("/order/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const order = await orderCollection.findOne({
        email: email,
      });
      res.send(order);
    });

    console.log("Connected to Database");
  } finally {
  }
};

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("TOPTOOL");
});
app.listen(port, () => console.log(`Listening on port ${port}`));
