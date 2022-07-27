//jshint esversion:6
require("dotenv").config();
const express = require("express");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStratergy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");
const app = express();
app.set("view engine", "ejs");
app.set("Cache-Control", "no-store");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: "Some sort of secret.",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb+srv://admin-"+process.env.ADMIN+":"+process.env.PASSWORD+"@cluster0.od74r.mongodb.net/userDb");
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId:String,
  Secret:String
});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());
passport.serializeUser(function (user, done) {
  done(null,user.id);
});
passport.deserializeUser(function (id, done) {
 User.findById(id,function(err,user){
    done(err,user);
 })
});
passport.use(
  new GoogleStratergy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
    },
    function (accessToken, refreshToken, profile, cb) {
      console.log(profile);
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

app.use(express.static("public"));

app.get("/", function (req, res) {
  res.render("home");
});

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile"],
  })
);

app.get(
  "/auth/google/secrets",
  passport.authenticate("google", {
    successRedirect: "/secrets",
    failureRedirect: "/login",
  })
);

app.get("/login", function (req, res) {
  res.render("login", { errMsg: "" });
});
app.get("/register", function (req, res) {
  res.render("register");
});
app.get("/secrets", function (req, res) {
    User.find({"Secret":{$ne:null}},function(err,foundUser){
        if(err)
        {
            console.log(err);
        }
        else
        {
            if(foundUser)
            {
                res.render("secrets",{userWithSecrets:foundUser});
            }
        }
    })
});

app.get('/submit',(req,res)=>{
    if (req.isAuthenticated()) {
        res.render("submit");
      } else {
        res.redirect("/login");
      }
})
app.post('/submit',(req,res)=>{
    const submittedSecret=req.body.secret;
    User.findById(req.user._id.toString(),(err,foundUser)=>{
        if(err)
        {
            console.log(err);
        }
        else
        {
            if(foundUser)
            {
                console.log(foundUser);
                foundUser.Secret=submittedSecret;
                foundUser.save(function(){
                    res.redirect("/secrets");   
                })
            }
        }
    })
})
app.post("/register", function (req, res) {
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/secrets");
        });
      }
    }
  );
});
app.get("/logout", function (req, res) {
  req.logOut(() => {
    res.redirect("/");
  });
});
app.post("/login", passport.authenticate("local"), (req, res) => {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });
  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/secrets");
      });
    }
  });
});
let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
