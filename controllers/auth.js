const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {validationResult} = require("express-validator");
const User = require("../models/user");
require('dotenv').config();
const {sendMail} = require("../utils/utils");


exports.register = async function (req,res){
   
        const errors = validationResult(req);
        if(!errors.isEmpty()){
            return res.status(400).json({errors: errors.array()});
        }

        const {firstName, lastName, email, password, confirmPassword} = req.body;

        if(password !== confirmPassword){
        return res.status(400).json({msg: "Passwords do not match"})
        }

        const salt = await bcrypt.genSalt(10);
        const encryptedPassword = await bcrypt.hash(password, salt);

        //generate OTP

        const otp = Math.floor(1000 + Math.random() * 9000);
        try{
            const user = await User.create({
                firstName,
                lastName,
                email:email.toLowerCase(),
                password: encryptedPassword,
                otp
            });
            const subject = 'Welcome to the Success Bank';
            const text = `Hi ${firstName} ${lastName}, welcome to the Success Bank.\n\nUse this code to verify your account: ${user.otp}`;
            sendMail(String(email), subject, text);

            res.status(201).json(user);
        }catch(err){
        res.status(400).json({msg: "Unable to create"})
    }
}


exports.login = async function(req,res){
    const errors = validationResult(req);

    if(!errors.isEmpty()){
        return res.status(401).json({errors: errors.array()});
    }

    const {email, password} = req.body;
 

    let user = await User.findOne({email})
   if(user && await bcrypt.compare(password, user.password)){
    
        const payload = {
            id: user.id
        };

        await jwt.sign(payload, process.env.TOKEN_KEY, { expiresIn: 3600000 }, (err, token) => {
            if (err) throw err;
            res.json({ token });
        });
    }
}


exports.verifyAccount = async function(req,res){
    const errors = validationResult(req);

    if(!errors.isEmpty()){
        return res.status(401).json({errors: errors.array()});

    }

    const{email, otp} = req.body;

    let user
    try{
        user = await User.findOne({email});
    }catch(err){
        return res.status(500).json({errors: [{msg: `${err}`}]})
    }
    if(otp !== user.otp){
        return res.status(422).json({errors: [{msg: 'OTP is incorrect'}]})
    }

    user.isActive = true;
    user.otp = null;
    await user.save();
    res.status(200).json({ msg: 'User verified' });

}


exports.forgotPassword = async function (req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res
                .status(422)
                .json({ errors: [{ msg: 'User does not exist' }] });
        }
        const otp = Math.floor(1000 + Math.random() * 9000);
        user.otp = otp;
        await user.save();
        // send mail
        const subject = 'Success Bank - Forgot Password';
        const text = `Hi ${user.firstName} ${user.lastName}, use this otp to reset your password: ${user.otp}`;
        sendMail(String(email), subject, text);
        res.status(200).json({ msg: 'OTP sent' });
    } catch (err) {
        if (err.code === 11000) {
            return res
                .status(422)
                .json({ errors: [{ msg: 'User does not exist' }] });
        }
        return res.status(500).json({ errors: [{ msg: 'Server error' }] });
    }
};

exports.resetPassword = async function (req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    const { email, otp, password, confirmPassword } = req.body;
    if (password !== confirmPassword) {
        return res
            .status(422)
            .json({ errors: [{ msg: 'Passwords do not match' }] });
    }

    let user;
    try {
        user = await User.findOne({ email });
    } catch (err) {
        if (err.code === 11000) {
            return res
                .status(422)
                .json({ errors: [{ msg: 'User does not exist' }] });
        }
        return res.status(500).json({ errors: [{ msg: 'Server error' }] });
    }

    if (user.otp !== Number(otp)) {
        return res.status(422).json({ errors: [{ msg: 'OTP is incorrect' }] });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    user.password = hashedPassword;
    user.otp = null;
    await user.save();
    res.status(200).json({ msg: 'Password Successfully Changed' });
};