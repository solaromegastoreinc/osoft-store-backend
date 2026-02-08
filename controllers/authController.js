// File: backend/controllers/authController.js
import userModel from "../models/User.js"; // Ensure .js extension

export const getUserData= async (req, res) => {
    try{
        // Use req.user which is set by the authMiddleware from the JWT token
        const userID = req.user;
        if (!userID) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: User ID not found in token."
            });
        }

        // Find the user by ID and explicitly exclude the password
        const user = await userModel.findById(userID).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        
        // Construct the full user object to send back
        // The optional chaining operator (`?.`) is a good way to handle
        // fields that may not exist on all user documents.
        res.status(200).json ({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                isAccountVerified: user.isAccountVerified,
                // These are the new fields you need to add to the response:
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                role: user.role,
                allowedPages: user.allowedPages,
                profilePicture: user.profilePicture,
            }
        });

    } catch (error){
        console.error("Error fetching user data:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch user data."
        });
    }
};
