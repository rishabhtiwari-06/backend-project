import {Router} from "express";
import {loginUser, logOutUser, registerUser} from "../controllers/user.controller.js"
import {upload} from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {refreshAccessToken} from "../controllers/user.controller.js"
const router = Router()

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
)  //Jaise hi aap /user pe jaaoge vaise hi vo userrouter pe bhejega fir ye userrouter use /register pe bhejega

router.route("/login").post(loginUser)

//Secured Routes
router.route("/logout").post(verifyJWT, logOutUser)

router.route("/refresh-token").post(refreshAccessToken)

export default router