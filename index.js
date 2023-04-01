// express
const express = require("express");
const app = express();
app.use(express.json());
app.use(require('cookie-parser')());

// dotenv
require('dotenv').config();

// mysql
const mysql = require("mysql2/promise");
let connection;
initDB();
async function initDB() {
  connection = await mysql.createConnection({
    host: 'localhost',
    user: 'onboarder_server',
    password: process.env.DB_PASS,
    database: 'onboarder'
  });
  console.log("Connected to DB");
}

// bcrypt
const bcrypt = require("bcrypt");

// nodemailer
const nodemailer = require("nodemailer");
let transporter = nodemailer.createTransport({
  host: "smtp.zoho.eu",
  secure: true,
  port: 465,
  auth: {
    user: "onboarder@trinitystudios.xyz",
    pass: process.env.EMAIL_PASS,
  },
});

// jsonwebtoken
const jwt = require("jsonwebtoken");

// get user data, no mater what table he is in
async function getUserDataByEmail(email) {
  let user;

  let [ rows, fields ] = await connection.query("SELECT * FROM managers WHERE email = ?", [email]);
  user = rows[0];

  if(user){
    user.role = "manager";
    return user;
  }

  [ rows, fields ] = await connection.query("SELECT * FROM old_employees WHERE email = ?", [email]);
  user = rows[0];

  if(user){
    user.role="old";
    return user;
  }

  [ rows, fields ] = await connection.query("SELECT * FROM new_employees WHERE email = ?", [email]);
  user = rows[0];

  if(user){
    user.role="new";
  }
  return user;
}

async function generateToken(refreshToken) {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
  } catch (err) {
    return "";
  }

  //check email exists
  const user = await getUserDataByEmail(decoded.email);
  if(!user){
    return "";
  }

  //check password correct
  if(decoded.hashedPass != user.password)
  {
    return "";
  }

  const accessTokenData = {
    "id": user.id,
    "role": user.role
  }

  const accessToken = jwt.sign(accessTokenData, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRATION,
  })

  return accessToken;
}

async function checkUser(req, res, next) {
  // check user is logged in
  if(!(req.cookies.accessToken && req.cookies.refreshToken)){
    res.sendStatus(401);
    return;
  }

  // decode accessToken
  jwt.verify(req.cookies.accessToken, process.env.JWT_SECRET, async (err, user) => {
    // refresh if necesary
    if(err){

      const newToken = await generateToken(req.cookies.refreshToken);

      if(newToken == ""){
        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");
        res.sendStatus(401);
        return;
      }

      res.cookie("accessToken", newToken);

      user = jwt.decode(newToken, process.env.JWT_SECRET);
    }

    req.user = user;
    next();
  })
}

// login route
app.post('/api/login', async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  
  //check email exists
  const user = await getUserDataByEmail(email);
  if(!user){
    res.sendStatus(403);
    return;
  }

  //check password correct
  const passwordCorrect = await bcrypt.compare(password, user.password);
  if(!passwordCorrect){
    res.sendStatus(403);
    return;
  }

  if(user.password_change_required){
    res.sendStatus(451);
    return;
  }

  const accessTokenData = {
    "id": user.id,
    "role": user.role
  }

  const refreshTokenData = {
    "email": user.email,
    "hashedPass": user.password
  }
  
  const accessToken = jwt.sign(accessTokenData, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRATION,
    
  })

  const refreshToken = jwt.sign(refreshTokenData, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRATION,
  })

  res.cookie("accessToken", accessToken, { httpOnly: true });
  res.cookie("refreshToken", refreshToken, { httpOnly: true });

  res.sendStatus(200);
})

app.post('/api/register', checkUser,  async (req,res) => {
  const email = req.body.email;
  const first_name = req.body.first_name;
  const last_name = req.body.last_name;
  const manager = 0;
  const hire_date = new Date().toISOString();

  const user = await getUserDataByEmail(email);

  if(user){
    res.sendStatus(409);
    return;
  }

  let password = '';
  const characters ='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for ( let i = 0; i < 10; i++ ) {
    password += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  const hashedPass = await bcrypt.hash(password, 10);

  try{
    await connection.query("INSERT INTO new_employees(email, password, first_name, last_name, manager, hire_date) VALUES(?, ?, ?, ?, ?, ?);", [ email, hashedPass, first_name, last_name, manager, hire_date]);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
    return;
  }

  const mailOptions = {
    from: "Onboarder <onboarder@trinitystudios.xyz>", // sender address
    to: email,
    subject: "Welcome to our team!", // Subject line
    html: '<div style=font-family:Helvetica><h3>Hello '+last_name+' '+first_name+', welcome to our team!</h3><p>You\'ve been added into our systems by Tudor Borca. In order to finish setting up your account, please log in at the address below.<table><tr><td style=padding:5px>Link<td style=padding:5px><a href=https://onboarder.trinitystudios.xyz>https://onboarder.trinitystudios.xyz</a><tr><td style=padding:5px>Email<td style=padding:5px>'+email+'<tr><td style=padding:5px>Password<td style=padding:5px>'+password+'</table><p>You will need to set a new password the first time you log in.</div>',
    text: `
      Hello `+last_name+` `+first_name+`, welcome to our team!
      You've been added into our systems by Tudor Borca. In order to finish setting up your account, please log in at the address below.

      Link	https://onboarder.trinitystudios.xyz
      Email	`+email+`
      Password	`+password+`
      You will need to set a new password the first time you log in.
    `, // plain text body
  };
  
  transporter.sendMail(mailOptions, function(err, info) {
    if (err) {
      console.log(err);
      res.sendStatus(500);
    }
    res.sendStatus(200);
  });
});

app.listen(process.env.PORT, ()=> {
  console.log("Server started on " + process.env.PORT)
})
