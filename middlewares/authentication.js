const { config } = require("dotenv");
const jwt = require("jsonwebtoken");

require ("dotenv").config();

exports.tokenVerification = (req, res, next) =>{
    const token = req.headers["Authorization"];

    if(!token){
        return res.status(403).json({msg: "A token is required for authorization"})
    }
    try{
        const decoded = jwt.verify(token, config.TOKEN_KEY);
        req.user = decoded;
    }catch(err){
        return res.status(401).json({msg: "Invalid Token"})
    }
    return next();
}

module.exports = tokenVerification;