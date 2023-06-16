require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.PAYMENT_SECRET);
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  // console.log(authorization);
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];
  // console.log(token);

  jwt.verify(token, process.env.TOKEN_SECRET, (err, decoded) => {
    // console.log(decoded);
    if (err) {
      // console.log(err);
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster.bhmzequ.mongodb.net/?retryWrites=true&w=majority`;

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
    await client.connect();
    const allUsers = client.db("sports").collection("users");
    const allClasses = client.db("sports").collection("classes");
    const allSelected = client.db("sports").collection("selectedClass");
    const allPayments = client.db("sports").collection("payments");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.TOKEN_SECRET, {
        expiresIn: "2h",
      });

      res.send({ token });
    });

    app.get("/users", async (req, res) => {
      const result = await allUsers.find().toArray();
      res.send(result);
    });

    app.get("/role", verifyJWT, async (req, res) => {
      const email = req.query?.email;
      // console.log(email);
      const role = await allUsers.findOne({ email: email });
      if (role) {
        res.send(role);
      } else {
        res.send({});
      }
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      // console.log(user);
      const existingUser = await allUsers.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exists" });
      }

      const result = await allUsers.insertOne(user);
      res.send(result);
    });

    app.put("/users/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const quary = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: body,
      };
      const result = await allUsers.updateOne(quary, updateDoc, options);
      res.send(result);
    });

    app.post("/class", async (req, res) => {
      const body = req.body;
      const result = await allClasses.insertOne(body);
      res.send(result);
    });

    app.get("/class/:email", async (req, res) => {
      const email = req.params.email;
      const query = { instructorEmail: email };
      const result = await allClasses.find(query).toArray();
      res.send(result);
    });

    app.get("/class", async (req, res) => {
      const finds = allClasses.find();
      const result = await finds.toArray();
      res.send(result);
    });

    app.put("/singleClass/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const body = req.body;
      const options = { upsert: true };
      const updateDoc = {
        $set: body,
      };
      const result = await allClasses.updateOne(query, updateDoc, options);
      res.send(result);
    });

    app.get("/classSingle/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allClasses.findOne(query);
      if (result) {
        res.send(result);
      } else {
        res.send({});
      }
    });

    app.get("/approveClass", async (req, res) => {
      const query = { status: "approve" };
      const result = await allClasses.find(query).toArray();
      res.send(result);
    });

    app.post("/selectedClass", async (req, res) => {
      const body = req.body;
      const result = await allSelected.insertOne(body);
      res.send(result);
    });

    app.get("/selectedClass/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query1 = { studentEmail: email };
      const query2 = { payment: false };
      const result = await allSelected
        .find({ $and: [query1, query2] })
        .toArray();
      res.send(result);
    });

    app.delete("/selectedClass/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allSelected.deleteOne(query);
      res.send(result);
    });

    app.get("/instructor", async (req, res) => {
      const query = { role: "instractor" };
      const result = await allUsers.find(query).toArray();
      res.send(result);
    });

    app.get("/popularClass", async (req, res) => {
      const query = { status: "approve" };
      const result = await allClasses
        .find(query)
        .sort({ enroll: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.get("/popularinstractor", async (req, res) => {
      const query = { role: "instractor" };
      const result = await allUsers
        .find(query)
        .sort({ enroll: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(+price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.get("/singleSelect/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allSelected.findOne(query);
      if (result) {
        res.send(result);
      } else {
        res.send({});
      }
    });

    app.put("/singleSelect/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const body = req.body;
      const options = { upsert: true };
      const updateDoc = {
        $set: body,
      };
      const result = await allSelected.updateOne(query, updateDoc, options);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
