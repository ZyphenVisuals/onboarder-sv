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

// faker
const { faker } = require('@faker-js/faker');

// random string
function generateRandomString(length) {
  let text = '';
  const characters ='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for ( let i = 0; i < length; i++ ) {
    text += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return text;
}

function stripUserData(userData, level) {
  delete userData.password;
  if(level >=1){
    delete userData.id;
    delete userData.password_change_required;
  }
  if(level >=2){
    delete userData.email;
  }
  return userData;
}

// get user data, no mater what table he is in
async function getUserDataByEmail(email) {
  let user;

  let [ rows, fields ] = await connection.query("SELECT * FROM managers WHERE email = ?", [email]);
  user = rows[0];

  if(user){
    user.role = "manager";
    return user;
  }

  [ rows, fields ] = await connection.query("SELECT * FROM employees WHERE email = ?", [email]);
  user = rows[0];

  if(user){
    [ rows, fields ] = await connection.query("SELECT TIMESTAMPDIFF(YEAR, now(), ?) AS age", [user.hire_date])
    if(rows[0].age > -1) {
      user.role="new";
    }
    else{
      user.role="old";
    }
    return user;
  }

  return user;
}

async function getUserDataByID(id, role) {

  if(role=="manager"){
    try {
      [ rows, fields ] = await connection.query("SELECT * FROM managers WHERE id = ?", [id]);
      if(!rows) return "";
      return rows[0];
    }
    catch (err) {
      console.log(err);
      return "";
    }
  }

  try {
    [ rows, fields ] = await connection.query("SELECT * FROM employees WHERE id = ?", [id]);
    if(!rows) return "";
    return rows[0];
  } catch (err) {
    console.log(err);
    return "";
  }
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
  if(!(req.body.email && req.body.password)){
    res.sendStatus(400);
    return;
  }

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

app.post('/api/resetPassword', async (req, res) => {
  if(!(req.body.email && req.body.oldPassword && req.body.newPassword)){
    res.sendStatus(400);
    return;
  }

  const email = req.body.email;
  const oldPassword = req.body.oldPassword;
  const newPassword = req.body.newPassword;

  //check email exists
  const user = await getUserDataByEmail(email);
  if(!user){
    res.sendStatus(403);
    return;
  }

  //check password correct
  const passwordCorrect = await bcrypt.compare(oldPassword, user.password);
  if(!passwordCorrect){
    res.sendStatus(403);
    return;
  }

  //generate new password
  const hashedPass = await bcrypt.hash(newPassword, 10);

  try {
    await connection.query("UPDATE employees SET password = ?, password_change_required = 0 WHERE email = ?", [hashedPass, email])
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
    return;
  }

  res.sendStatus(200);
  return;
})

app.post('/api/utils/generateFakeUsers', async (req, res) => {
  const count = req.body.count || 5;

  for(let x=0; x<count; x++){
    const first_name = faker.name.firstName();
    const last_name = faker.name.lastName();
    const email = "fake-" + faker.internet.email(first_name, last_name);
    const password = await bcrypt.hash(generateRandomString(5), 5);
    const hire_date = faker.datatype.datetime().toISOString().slice(0, 19).replace('T', ' ');
    const industry = Math.floor(Math.random()*4.99);
    const frontend_or_backend = Math.floor(Math.random()*2.99);
    const tech_stack = faker.helpers.arrayElements(["react", "angular", "vue", "solid", "svelte", "node", "express", "socket.io", "django", "ruby on rails", "asp.net", "actix", "rocket.rs"]).join(',');
    const language_familiarity = faker.helpers.shuffle(["1","1","1","1","2","2","2","2","3","3"]).join('');
    const tools_familiarity = faker.helpers.shuffle(["1","1","1","1","2","2","2","2","3","3"]).join(''); 
    const communication_style = Math.floor(Math.random()*9.99);
    const conflict_style = Math.floor(Math.random()*4.99);
    const communication_skills = String(Math.floor((Math.random()+1)*2.9)) + String(Math.floor((Math.random()+1)*2.9)) + String(Math.floor((Math.random()+1)*2.9));
    const teamwork_skills = String(Math.floor((Math.random()+1)*2.9)) + String(Math.floor((Math.random()+1)*2.9)) + String(Math.floor((Math.random()+1)*2.9));
    const manager = Math.floor(Math.random()*2.5)+1;

    console.log("Adding fake user " + first_name + " " + last_name);

    try {
      await connection.query("INSERT INTO employees(email, password, first_name, last_name, manager, hire_date, industry, front_or_backend, tech_stack, language_familiarity, tools_familiarity, communication_style, conflict_style, communication_skills, teamwork_skills, profile_picture) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
        email,
        password,
        first_name,
        last_name,
        manager,
        hire_date,
        industry,
        frontend_or_backend,
        tech_stack,
        language_familiarity,
        tools_familiarity,
        communication_style,
        conflict_style,
        communication_skills,
        teamwork_skills,
        "none"
      ])
    } catch (err) {
      console.log(err);
      break;
    }
  }

  res.sendStatus(200);
});

app.post('/api/utils/removeFakeUsers', async (req, res) => {
  try{
    await connection.query("DELETE FROM employees WHERE email LIKE 'fake%'");
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
    return;
  }
  res.sendStatus(200);
  return;
})

app.post('/api/register', checkUser,  async (req,res) => {
  if(!(req.body.email && req.body.first_name && req.body.last_name && req.body.hire_date)) {
    res.sendStatus(400);
    return;
  }

  if(req.user.role != "manager"){
    res.sendStatus(403);
    return;

  }

  const email = req.body.email;
  const first_name = req.body.first_name;
  const last_name = req.body.last_name;
  const manager = req.user.id;
  const hire_date = req.body.hire_date;

  const user = await getUserDataByEmail(email);

  if(user){
    res.sendStatus(409);
    return;
  }

  let password = generateRandomString(10);

  const hashedPass = await bcrypt.hash(password, 10);

  try{
    await connection.query("INSERT INTO employees(email, password, first_name, last_name, manager, hire_date) VALUES(?, ?, ?, ?, ?, ?);", [ email, hashedPass, first_name, last_name, manager, hire_date]);
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

app.get('/api/getUserData', checkUser, async (req, res) => {
  let userData = await getUserDataByID(req.user.id, req.user.role);
  if(userData == ""){
    res.sendStatus(500);
    return;
  }
  userData.role = req.user.role;
  userData = stripUserData(userData, 1);
  res.status(200).send(userData);
})

app.post('/api/updateUserData', checkUser, async (req, res) => {
  if(req.body.email == undefined || 
  req.body.first_name == undefined || 
  req.body.last_name == undefined || 
  req.body.industry == undefined || 
  req.body.front_or_backend == undefined || 
  req.body.tech_stack == undefined || 
  req.body.language_familiarity == undefined || 
  req.body.tools_familiarity == undefined ||
  req.body.communication_style == undefined ||
  req.body.conflict_style == undefined ||
  req.body.communication_skills == undefined ||
  req.body.teamwork_skills == undefined ||
  req.body.profile_picture == undefined ||
  req.user.role == "manager"){
    res.sendStatus(400);
    return;
  }

  try{
    await connection.query("UPDATE employees SET email = ?, first_name = ?, last_name = ?, industry = ?, front_or_backend = ?, tech_stack = ?, language_familiarity = ?, tools_familiarity = ?, communication_style = ?, conflict_style = ?, communication_skills = ?, teamwork_skills = ?, profile_picture = ? WHERE id = ?", [
      req.body.email,
      req.body.first_name,
      req.body.last_name,
      req.body.industry,
      req.body.front_or_backend,
      req.body.tech_stack,
      req.body.language_familiarity,
      req.body.tools_familiarity,
      req.body.communication_style,
      req.body.conflict_style,
      req.body.communication_skills,
      req.body.teamwork_skills,
      req.body.profile_picture,
      req.user.id
    ])
    res.sendStatus(200);
    return;
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
    return;
  }
})

app.get('/api/getEmployeesData/:page', checkUser, async (req, res) => {
  if(req.user.role != "manager") {
    res.sendStatus(403);
    return;
  }

  if(req.params.page < 1) {
    res.sendStatus(400);
    return;
  }

  let employeesData;

  try {
    [ rows, fields ]  = await connection.query("SELECT * FROM employees WHERE manager = ? ORDER BY id LIMIT ?, 30", [req.user.id, (req.params.page-1)*10 ])
    employeesData = rows;
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
    return;
  }

  employeesData.forEach(employee => {
    employee = stripUserData(employee, 0);
  });

  res.status(200).send(employeesData);
  return;
})

app.listen(process.env.PORT, ()=> {
  console.log("Server started on " + process.env.PORT)
})
