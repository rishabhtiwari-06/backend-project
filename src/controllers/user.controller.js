import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/fileUpload.js";
import {ApiResponse} from "../utils/ApiResponse.js"


const registerUser = asyncHandler( async (req,res)=>{

    //Get User Details
    //Validate if data is empty or not
    //Check if user already exists or not
    //Check for images , or Avatar
    //If images availble, send then to clodinary and check multer or clodinary if they successfullly got this
    //Register user in database
    //Remove Password nd refresh token from response
    //Check if user got registered nd if done then send response 

    const {fullName, username, email, password} = req.body
    console.log("Email Is: ",email)
    //This code checks if any feild provided by the frontend is empty or not , if empty returns error
    if (
        [fullName, email, username, password].some((field) => field?.trim()=== "")
    ){
        throw new ApiError(400, "fullName is Required")
    }
    const existedUser = User.findOne({
        $or: [{email},{username}]
    })
    if(existedUser){
        throw new ApiError(409, "User with this email or username already exist")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path
    const coverImageLocalPath = req.files?.coverImage[0].path
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar is required");   
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath) 
    if ( !avatar) {
        throw new ApiError(400,"Avatar couldn't not be uploaded on cloudinary");           
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })
    const userCreated = await User.findById(user._id).select("-password -refreshToken")
    //Select method ke through hm jo nahi chaiye use string format me likh dete h but sirf db ke saath use hota h ye
    if(!userCreated){
        throw new ApiError(500,"Issue in registering user ")
    }
    return res.status(201).json(
        new ApiResponse(200, userCreated, "User registered Successfully")
    )
})   

export {registerUser} 