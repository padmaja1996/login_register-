const express = require('express');
const router = express.Router();

//mongodb user model
const User = require('./../models/User');

//mongodb user verification model
const UserVerification = require('./../models/UserVerification');




//mongoodb user otp verification
const UserOTPVerfication= require('./../models/UserOTPVerification');

//email handler
const nodemailer = require('nodemailer');

//unique string
const{v4: uuidv4}=require('uuid');


//env variable
require("dotenv").config();



//password handler
const bcrypt= require('bcrypt');



//path for  static verified page
const path = require("path");


//node mailer stuff
let transporter = nodemailer.createTransport({
    service :"gmail",
   
    auth:{
        user : "padmaja.patil551632@gmail.com",
        pass : "batiopliluwkzrqu"
    }
})
 


//testing successful
transporter.verify((error,success) =>{
    if(error){
        console.log(error);
    }else{
        console.log("Ready for message");
        console.log(success);

    }
})




//signup
router.post('/signup',(req, res) => {
    let { name, email, password, dateOfBirth } = req.body;
    name= name.trim();
    email = email.trim();
    password = password.trim();
    dateOfBirth = dateOfBirth.trim();

    if(name == "" || email == "" || password == "" || dateOfBirth == ""){
        res.json({
            status: "FAILED",
            message:"Empty input fields"
        });
    }else if(!/^[a-zA-Z ]*$/.test(name)){
        res.json({
            status:"FAILED",
            message:"Invalid name enterd"
        })
    }else if(!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)){
        res.json({
            status:"FAILED",
            message:"Invalid email enterd"
        })
    } 
    
    else if (!new Date(dateOfBirth).getTime()){
        res.json({
            status:"FAILED",
            message:"Invalid date of birth enterd"
        })
    } else if(password.length<8){
        res.json({
            status: "FAILED",
            message:"password is too short!"

        })

    } else {
        //checking if user alredy exists
        User.find({email}).then(result =>{

            if(result.length){
                //a user already exists
                res.json({
                    status:"FAILED",
                    message:"User with the provided email already exists"
                })
            }
            else{
                //try to create new user

                //password handling
                const saltRounds=10;
                bcrypt.hash(password,saltRounds).then(hashedPassword =>{
                    const newUser = new User({
                        name,
                        email,
                        password: hashedPassword,
                        dateOfBirth,
                        verified: false,
                    });
                    newUser
                    .save()
                    .then((result) =>{
                        sendOTPVerificationEmail(result,res)
                        //sendVerificationEmail(result,res);



                    })
                    
                    .catch(err =>{
                        console.log(err);
                      res.json({
                        status:"FAILED",
                        message:"An error ocuured while saving user account!"

                    })

                })
            })
                .catch(err =>{ 
                    console.log(err);
                    res.json({
                        status:"FAILED",
                        message:"An error ocuured while hashing table!"
                    })
                })
            }
            
}).catch(err =>{
            console.log(err);
            res.json({
                status:"FAILED",
                message:"An error ocuured while checking for existing user!"
            })

        })

    }
    

})


//send verification verification mail
const sendVerificationEmail =({_id, email},res) =>{
 //url used to be in mail
 const currentUrl="http://localhost:4000/";


 const uniqueString= uuidv4() + _id;
 
 
 
 //mail options
 const mailOptions={
     from: "padmaja.patil551632@gmail.com",
     to: email,
     subject:"verify your Email",
     html:`<p>Verify your email address to complete the sign up and login into your account.</p><p>This link <b>expires in 6 hours.</b></p><p>Press <a href=${currentUrl+"user/verify/" + _id  +
     "/" + uniqueString}> here </a> to procceed.</p>`,
 };

// hash the unique string 
const saltRounds=10;
bcrypt
.hash(uniqueString,saltRounds)
.then((hashedUniqueString) =>{
//set values in userverification collection 
const newVerification = new UserVerification({
    userId: _id,
    uniqueString: hashedUniqueString,
    createdAt:Date.now(),
    expiresAt: Date.now() + 21600000,

});

newVerification
.save()
.then(() =>{
    transporter
    .sendMail(mailOptions)
    .then(() =>{
        //email sent and verification record save
        res.json({
            status:"PENDING",
            message:"verification email sent",
        })
    })
    .catch((error)=>{
        console.log(error);
        res.json({
            status:"FAILED",
            message:"verification mail failed!",
        })
    })

})
.catch((error) => {
    console.log(error);
    res.json({
        status:"FAILED",
        message:"Couldn't save verification email data!",
    })
})

})
.catch((error) =>{
    console.log(error);
    res.json({
        status:"FAILED",
        message:"An error occured while hasing email data!",
    })
})

};

//verify email
router.get( "/verify/:userId/:uniqueString ",(req,res) =>{
    let{userId,uniqueString}= req.params;

    UserVerification
    .find({userId})
    .then((result) =>{
        if(result.length > 0){
            //user verification records exists

const{expiresAt} = result[0];
const hashedUniqueString = result[0].uniqueString;

if(expiresAt < Date.now()){
    //record has been expired
    UserVerification.deleteOne({userId})
    .then(result=>{
        User
        .deleteOne({_id:userId})
        .then(result =>{
            User
            .deleteOne({_id:userId})
            .then(() =>{
                let message="link has been expired .Please sign up again";
                res.redirect(`/user/verified/error=true&message =${message}`);
            })



        })
        .catch(error => {
            console.log(error);
            let message="Clearing user with expired unique string failed";
            res.redirect(`/user/verified/error=true&message =${message}`);
           
        })
    })
    .catch((error) =>{
        console.log(error);
        let message="An error occured while clearing expired user verification record";
res.redirect(`/user/verified/error=true&message =${message}`);
    })
} else{
    //valid record existing so we validate the user string
    //first compare the hashed unique uniqueString

bcrypt
 .compare(uniqueString , hashedUniqueString)
 .then(result =>{
     if(result)
{
    //string match


User.updateOne({_id:userId},{verified:true})
.then(() =>{
    UserVerification.deleteOne({userId})
    .then(()=>{
        res.sendFile(path.join(__dirname,"./../views/verified.html"));
    })
    .catch(error =>{
        console.log(error);
        let message="An error occured while finalizing successful verification";
        res.redirect(`/user/verified/error=true&message =${message}`);
    })
})
.catch(error =>{
    console.log(error);
    let message="An error occured while updating user record to show verified";
    res.redirect(`/user/verified/error=true&message =${message}`);
})


}else{
    //existing record but incorrect verification details
    let message="Invalid verification details are passesd";
    res.redirect(`/user/verified/error=true&message =${message}`);
} 

})
 .catch(error =>{
     console.log(error);
    let message="An error occured while comparing unique string";
    res.redirect(`/user/verified/error=true&message =${message}`);
 })

}


        }else{
            //user verification doent existes
            let message="Acount record doent exists or haS BEEN verified already.please signup or login";
        res.redirect(`/user/verified/error=true&message =${message}`);
        }
    })

    .catch((error) =>{
        console.log(error);
let message="An error occured  while checking for existance user verification  record";
res.redirect(`/user/verified/error=true&message =${message}`);

    })
})

//verified page route
router.get("/verified",(req,res) =>{
    res.sendFile(path.join(__dirname, "./../views/verified.html"));

})










//signin
router.post('/signin',(req, res) =>{
    let {  email, password } = req.body;

    email = email.trim();
    password = password.trim();

    if(email == "" || password == ""){
        res.json({
            status:"FAILED",
            message:"Empty credentials supplied"
        })
    }else {
        //check if user existes
        User.find({email})
.then(data => {
    if(data.length){
        //user exists


// check if useris existes
if (!data[0].verified){

    res.json({
        status:"FAILED",
        message:"Email hasn't been verified yer check your inbox"
    });
}
else{
    const hashedPassword=data[0].password;
    bcrypt.compare(password,hashedPassword).then(result =>{
        if(result){
            //password match
            res.json({
                status:"SUCCESS",
                message:"Signin successful",
                data:data
            })
        }else{
            res.json({
                status:"FAILED",
                message:"Invalid password enterd"
            })
        }
    })
            .catch(err =>{
                res.json({
                    status:"FAILED",
                    message:"An error occured while comparing password"
                })
            })
        }

}


            else{
                res.json({
                    status:"FAILED",
                    message:"Invalid credintial enterd!"

            
        })

    }
})

.catch(err =>{
    res.json({
        status:"FAILED",
        message:"An error occured while checking for existing user"
    })
})
    }

})
    

//send otp verification email
const sendOTPVerificationEmail = async({_id,email},res) => {
    try{
const otp = `${Math.floor(1000 + Math.random() * 9000)}`;
//mail option
const mailOption = {
    from:"padmaja.patil551632@gmail.com",
    to:email,
    subject:"Verify Your E-mail",
    html:`<p> Enter <b> ${otp} </b>in the app to verify your email address and complete the signin process </p>`
    `<p> This code <b> expires in 1 hour</b></p>`,
};

//hash the otp
const saltRounds= 10;

const hashedOTP = await bcrypt.hash(otp, saltRounds);
const newOTPVerification = await new UserOTPVerfication({


    userId:_id,
    otp:hashedOTP,
    createdAt: Date.now(),
    expiresAt: Date.now()+ 3600000,
});
await newOTPVerification.save();
await transporter.sendMail(mailOptions);
res.json({
    status:"PENDING",
    message:"Verification OTP email sent",
    data:{
        userId:_id,
        email,

    },
})

    }
    catch(error){
res.json({
    status:"FAILED",
    message:error.message,
})
        }
    };


router.post("/verifyOTP", async(req,res)=> {
    try{
        let{userId,otp} = req.body;
        if(!userId || !otp){
            throw Error("Empty otp details are not allowd");
        }else{
            const UserOTPVerficationRecords=await UserOTPVerfication.find({
                userId,
            });
            if(UserOTPVerficationRecords.length <= 0){
                //no record found
                throw new Error(
                    "Account records doesn't exist or has been verified already. please signup or login"
                );
            }else{
                const{expiresAt} = UserOTPVerficationRecords[0];
                const hashedOTP= UserOTPVerficationRecords[0].otp;

                if(expiresAt < Date.now()){
                    //otp has been expired
                  await UserOTPVerfication.deleteMany({ userId});
                  throw new Error("Code has been expired.please request again.");
                }else{
                    const validOTP=await bcrypt.compare(otp,hashedOTP);

                    if(!validOTP){
                        //supplied otp wrong
                        throw new Error("Invalid code passed.check you inbox.");
                    }else{
                        //successful

                        await User.updateOne({ _id:userId },{ verified:true});
                        await UserOTPVerfication.deleteMany({userId});
                        res.json({
                            status:"VERIFIED",
                            message:`User email verified succesfully.`,
                        })
                    }
                }
            }
        }

    }catch(error){

        res.json({
            status:"FAILED",
            message:error.message,
        });
    }

});


//resend verification
router.post("/resendOTPVerificationCode",async(req,res) =>{
    try{
        let{userId,email} = req.body;

        if(!userId || !email){
            throw Error("Empty user details are not allowed");
        }else{
            //delete existibg record and resend
            await UserOTPVerfication.deleteMany({ userId });
            sendOTPVerificationEmail({_id:userId,email},res);
        }
    }catch(error){

        res.json({
            status:"FAILED",
            message:error.message,
        })
    }
})









module.exports = router;