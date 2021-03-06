const {validationResult} = require("express-validator");
const Account = require("../models/account");
const User = require("../models/user")
const TransactionHistory = require("../models/transactionHistory");
const {generateAccountNumber} = require("../utils/utils")


exports.createAccount = async function(req, res){
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(400).json({errors: errors.array()})
    }

    const {id} = req.user;
    console.log(id);
    //const user = User.findOne(req.user)
    //console.log(user);
    // let user;
    let user;
    try{
        user = await User.findById(id);

        if(user.account){
            return res.status(400).json({msg: "you already have an account"})
        }
    } catch (err) {
        if (err.message === "Cannot read property 'account' of null") {
            return res
                .status(401)
                .json({ msg: 'Invalid authentication credentials' });
        }
        return res.status(500).json({ message: 'Server error' });
    }
    // create bank account
    const { accountType, pin, confirmPin } = req.body;
    if (pin !== confirmPin) {
        return res.status(400).json({ msg: 'Pins do not match' });
    }
    const account = new Account({
        owner: id,
        accountType,
        pin,
        number: await generateAccountNumber(),
    });

    try {
        await account.save();
    } catch (err) {
        console.log(err.message);
        if (err.message.includes('is not a valid enum value')) {
            return res.status(400).json({ msg: 'Invalid account type' });
        }
        return res.status(500).json({ message: 'Server error' });
    }

    user.account = account._id;
    await user.save();
    res.status(201).json({ account });
}

exports.deposit = async function (req, res){
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(422).json({errors: errors.array()});
    }

    const {id} = req.user;
    console.log(id);
    const{accountId} = req.params;
    const{amount, description} = req.body;


    let account;
    try{
        account = await Account.findById(accountId);
    }catch(err){
        if(err.message.includes('Cast to ObjectId failed for value')){
            return res.status(400).json({msg: "Invalid Account Id"})
        }
        return res.status(500).json({msg: "Server error"})
    }

    if(!account){
        return res.status(400).json({msg: "Bank Account not found"});
    }

        if(account.owner.toString() !== id){
            return res.status(401).json({msg: "Unauthorized"});
        }

        // create transaction history

        const transaction = new TransactionHistory ({
            title: "DEPOSIT",
            type: "CREDIT",
            amount, 
            description,
            account: accountId
        });

        try{
            await transaction.save();
        }catch(err){
            console.log(err.message);
            return res.status(500).json({msg: 'Server error'})
        }


        account.balance +=amount;
        account.transactions.push(transaction._id);
        await account.save();
        res.status(200).json({account});
}


exports.withdrawal = async function(req,res){
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(422).json({errors: errors.array()});
    }

    const {id} = req.user;
    console.log(id);
    const {accountId} = req.params;
  
    const {amount, description, pin} = req.body;

    let account;
    
    try{
        account = await Account.findById(accountId);
        console.log(account.owner)
    }catch(err){
        if(err.message.includes('Cast to ObjectId failed for value')){
            return res.status(400).json({msg: "Invalid Account Id"})
        }
        return res.status(500).json({msg: "Server error"})
    }

    if(!account){
        return res.status(400).json({msg: "Bank Account not found"});
    }

        if(account.owner.toString() !== id){
            return res.status(401).json({msg: "Unauthorized"});
        }

    if(account.balance < amount){
        return res.status(400).json({msg: "Insufficient Funds"})
    }

    if(account.pin !== pin){
        return res.status(400).json({msg: "Invalid Pin"})
    }

    account.balance -=amount;
    // create transaction history

    const transaction = new TransactionHistory ({
        title: "WITHDRAWAL",
        type: "DEBIT",
        amount, 
        description,
        account: accountId
    });

    try{
        await transaction.save();
        account.transactions.push(transaction._id);
        await account.save();
        res.status(200).json({msg: "Withdrawal Successful"})
    }catch(err){
        console.log(err.message);
        return res.status(500).json({msg: 'Server error'})
    }


    account.balance +=amount;
    account.transactions.push(transaction._id);
    await account.save();
   // res.status(200).json({account});
}


exports.transfer = async function(req, res){
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(422).json({errors: errors.array()});
    }

    const {id} = req.user;
    console.log(id);
    const {accountId} = req.params;
  
    const {amount, description,recipientAccountNumber, pin} = req.body;

    let account;

    try{
        account = Account.findById(accountId)
    }catch(err){
        if(err.message.includes('Cast to ObjectId failed for value')){
            return res.status(400).json({msg: "Invalid Account Id"})
        }
        return res.status(500).json({msg: "Server error"})
    }

    if(!account){
        return res.status(400).json({msg:"Account not found"})
    }
    
    if(account.owner.toString() !== id){
        return res.status(401).json({msg: "Unauthorized"});
    }

    

    let recipientAccount ;
    try{
        recipientAccount = await Account.findOne({number: recipientAccountNumber})
    }catch(err){
        return res.status(500).json({msg: "Server error"})
    }

    if(!recipientAccount){
        return res.status(400).json({msg: "Account Number does not exist"})
    }

    account.balance -=amount;
    recipientAccount.balance +=amount;
    // create transaction history

    const senderTransaction = new TransactionHistory ({
        title: "TRANSFER",
        type: "DEBIT",
        amount, 
        description,
        account: accountId
    });

    const recipientTransaction = new TransactionHistory ({
        title: "TRANSFER",
        type: "CREDIT",
        amount, 
        description,
        account: recipientAccount._id
    });

    try{

        account.transactions.push(transaction._id);
        recipientAccount.transactions.push(recipientTransaction._id);
        
        await senderTransaction.save();  
        await recipientTransaction.save();      
    
        
        await account.save();
        await recipientAccount.save();
        res.status(200).json({msg: "Transfer Successful"})
    }catch(err){
        console.log(err.message);
        return res.status(500).json({msg: 'Server error'})
    }


}

exports.getBalance = async function (req, res) {
    const { id } = req.user;
    const { accountId } = req.params;

    // check if user has an account
    let account;
    try {
        account = await Account.findById(accountId);
    } catch (err) {
        if (err.message.includes('Cast to ObjectId failed for value')) {
            return res.status(400).json({ msg: 'Invalid account ID' });
        }
        return res.status(500).json({ message: 'Server error' });
    }

    if (!account) {
        return res.status(404).json({ msg: 'Bank Account not found' });
    }

    // check if user owns the account
    if (account.owner.toString() !== id) {
        return res.status(401).json({ msg: 'Unauthorized' });
    }

    res.status(200).json({ balance: account.balance });
};

/**
 * @desc retrieves transaction history for the authenticated user
 */
exports.getHistory = async function (req, res) {
    const { id } = req.user;
    const { accountId } = req.params;

    // check if user has an account
    let account;
    try {
        account = await Account.findById(accountId);
    } catch (err) {
        if (err.message.includes('Cast to ObjectId failed for value')) {
            return res.status(400).json({ msg: 'Invalid account ID' });
        }
        return res.status(500).json({ message: 'Server error' });
    }

    if (!account) {
        return res.status(404).json({ msg: 'Bank Account not found' });
    }

    // check if user owns the account
    if (account.owner.toString() !== id) {
        return res.status(401).json({ msg: 'Unauthorized' });
    }

    const transactions = await TransactionHistory.find({ account: accountId });
    res.status(200).json({ transactions });
};
