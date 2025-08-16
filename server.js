require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const cors = require('cors');
const knex  = require('knex');
const fetch = require('node-fetch');
const Clarifai = require('clarifai');


const db  = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  },
});

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.json()); // ✅ parse JSON bodies
app.use(express.urlencoded({ extended: true }));//✅ parse form bodies if coming from HTML forms

db.select('*').from('users').then(data => {
  console.log(data);
});

//SignIn Logic
app.post('/signin', (req, res) => {
  if(!req.body.email || !req.body.password) {
    return res.status(400).json('Please enter all the fields');
  }
  db.select('email', 'hash').from('login')
  .where('email', '=', req.body.email)
  .then(data =>{
   const isValid = bcrypt.compareSync(req.body.password, data[0].hash)
   console.log(isValid);
   if(isValid){
    return db.select("*").from("users").where("email", "=", req.body.email)
    .then(user => {
      console.log(user);
      res.json(user[0]);
    })
    .catch(err => res.status(400).json('Unable to get user'));
   }else {
        // Add this else block to respond when pas  sword is wrong
        res.status(400).json('Wrong credentials');
      }
  })
  .catch(err => res.status(400).json('Wrong credentials'));
});

//Register Logic
app.post('/register', (req, res) => {
  const {email, name, password} = req.body;
  if(!email || !name || !password) {
    return res.status(400).json('Please enter all the fields');
  }
  const hash =  bcrypt.hashSync(password, 10);
  db.transaction(trx => {
    trx.insert({
      hash: hash,
      email: email
    })
    .into('login')
    .returning('email')
    .then(loginEmail => {
       return trx('users')
    .returning('*')
    .insert({
    email: loginEmail[0].email,
    name: name,
    joined: new Date(),
  })
  .then(user =>{
    res.json(user[0]);
  });

  })
  .then(trx.commit)
  .catch(trx.rollback);
});
});

//Profile Logic
app.get('/profile/:id', (req, res) => {
  const { id } = req.params; 
  db.select('*').from('users').where({ id }).then(user => {
    if (user.length) {
      return res.json(user[0]);
    } else {
      res.status(404).json('User not found');
    }
  })
  .catch(err => res.status(400).json('error getting user'));
});

// THIS IS THE NEW ENDPOINT THAT WAS MISSING
app.post('/imageurl', (req, res) => {
  const PAT = process.env.CLARIFAI_PAT;
  const USER_ID = 'clarifai';
  const APP_ID = 'main';
  const MODEL_ID = 'face-detection';
  const MODEL_VERSION_ID = '6dc7e46bc9124c5c8824be4822abe105'; // Optional but good practice

  const raw = JSON.stringify({
    "user_app_id": { "user_id": USER_ID, "app_id": APP_ID },
    "inputs": [{ "data": { "image": { "url": req.body.input } } }]
  });

  const requestOptions = {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': 'Key ' + PAT
    },
    body: raw
  };

  fetch(`https://api.clarifai.com/v2/models/${MODEL_ID}/outputs`, requestOptions)
    .then(response => response.json())
    .then(data => res.json(data))
    .catch(err => res.status(400).json('Unable to work with API'));
});

//image response logic
app.put('/image', (req, res) => {
  const { id } = req.body;
  db('users').where('id', '=', id)
    .increment('entries', 1)
    .returning('entries')
    .then(entries => {
      if (entries.length) {
        res.json(entries[0].entries);
      } else {
        res.status(400).json('user not found')
      }
    })
    .catch(err => res.status(400).json('error updating entries'));
});

//final calling the app to listen the server
app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on port ${process.env.PORT || 3000}`);
});
