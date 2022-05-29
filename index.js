const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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
    //collections
    const toolsCollection = client.db("toptool").collection("tools");
    const usersCollection = client.db("toptool").collection("users");
    const ordersCollection = client.db("toptool").collection("orders");
    const reviewsCollection = client.db("toptool").collection("reviews");

    //stripe api
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { totalPrice } = req.body;
      const amount = totalPrice * 100;

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

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
    //delete tool by id
    app.delete("/tool/:id", verifyJWT, async (req, res) => {
      const tool = await toolsCollection.deleteOne({
        _id: ObjectId(req.params.id),
      });
      res.send(tool);
    });
    //post a tool
    app.post("/tool", verifyJWT, async (req, res) => {
      const tool = await toolsCollection.insertOne(req.body);
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
    //get all users
    app.get("/users", async (req, res) => {
      const users = await usersCollection.find({}).toArray();
      res.send(users);
    });
    //get user by email
    app.get("/user/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({
        email: email,
      });
      res.send(user);
    });
    //update user by email
    app.put("/user/:email", verifyJWT, async (req, res) => {
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
      res.send(result);
    });
    //delete a user
    app.delete("/user/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const user = await usersCollection.deleteOne(filter);
      res.send(user);
    });

    //check admin
    app.get("/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });
    //make a user to admin
    app.put("/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updatedDoc = {
        $set: { role: "admin" },
      };
      const result = await usersCollection.updateOne(filter, updatedDoc);
      return res.send(result);
    });

    //get all orders
    app.get("/orders", verifyJWT, async (req, res) => {
      const orders = await ordersCollection.find({}).toArray();
      res.send(orders);
    });
    //get order by id
    app.get("/order/:id", verifyJWT, async (req, res) => {
      const order = await ordersCollection.findOne({
        _id: ObjectId(req.params.id),
      });
      res.send(order);
    });
    //patch order by id
    app.patch("/order/:id", verifyJWT, async (req, res) => {
      const order = req.body;
      const filter = { _id: ObjectId(req.params.id) };
      const updatedDoc = {
        $set: order,
      };
      const result = await ordersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    //post a order
    app.post("/order", verifyJWT, async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });
    //get orders by email
    app.get("/orders/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const orders = await ordersCollection.find({ email: email }).toArray();
      res.send(orders);
    });
    //delete order by id
    app.delete("/order/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const result = await ordersCollection.deleteOne({ _id: ObjectId(id) });
      res.send(result);
    });
    //change a order paid status to unpaid using patch
    app.patch("/unpaid/:id", async (req, res) => {
      const id = req.params.id;
      const result = await ordersCollection.updateOne(
        { _id: ObjectId(id) },
        { $set: { paid: false, status: null } }
      );
      res.send(result);
    });
    //change a order paid status to unpaid using patch
    app.patch("/shipped/:id", async (req, res) => {
      const id = req.params.id;
      const result = await ordersCollection.updateOne(
        { _id: ObjectId(id) },
        { $set: { status: "shipped" } }
      );
      res.send(result);
    });

    //get all reviews
    app.get("/reviews", async (req, res) => {
      const reviews = await reviewsCollection.find({}).toArray();
      res.send(reviews);
    });
    //post a review
    app.post("/review", verifyJWT, async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
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
