import dotenv from 'dotenv'; // Import dotenv to access SENDER_EMAIL
import transporter from '../utils/email.js'; // Import the pre-configured transporter
dotenv.config(); // Load environment variables

export const sendContactEmail = async (req, res) => {
    // Destructure fields. recipientEmail is no longer expected from frontend.
    const { firstName, lastName, email, phone, message } = req.body;

    // Your personal email where you want to receive contact messages
    const YOUR_PERSONAL_RECEIVING_EMAIL = 'mrn7king@gmail.com'; // Hardcode your receiving email here

    // Basic validation (recipientEmail is no longer required from frontend)
    if (!firstName || !lastName || !email || !message) {
        return res.status(400).json({ success: false, message: 'All required fields (First Name, Last Name, Email, and Message) are necessary.' });
    }

    try {
        // Construct the email content
        const mailOptions = {
            from: process.env.SENDER_EMAIL, // This MUST be your verified sender email (e.g., mrn7king@gmail.com from your .env)
            to: YOUR_PERSONAL_RECEIVING_EMAIL, // The email will be sent to your personal account
            replyTo: email, // Set the user's email as the Reply-To address for easy response
            subject: `New Contact Form Submission from ${firstName} ${lastName}`,
            html: `
                <p>You have received a new message from your E-Commerce contact form.</p>
                <h3>Contact Details:</h3>
                <ul>
                    <li><strong>Name:</strong> ${firstName} ${lastName}</li>
                    <li><strong>Email (User's):</strong> ${email}</li>
                    <li><strong>Phone:</strong> ${phone || 'N/A'}</li>
                </ul>
                <h3>Message:</h3>
                <p>${message}</p>
                <hr>
                <p>To reply to the user, simply use your email client's "Reply" function. The reply will go to: ${email}</p>
            `,
        };

        // Send the email using the imported transporter
        await transporter.sendMail(mailOptions);

        res.status(200).json({ success: true, message: 'Your message has been sent successfully!' });

    } catch (error) {
        console.error('❌ Error sending contact email:', error);
        let errorMessage = 'Failed to send message. Please try again later.';
        if (error.code === 'EAUTH') {
            errorMessage = 'Authentication error with email service. Please check server logs.';
        } else if (error.responseCode === 535) {
            errorMessage = 'Email service authentication failed. Check your email user/password or app password.';
        } else if (error.response && error.response.includes('Sender email is not verified')) {
            errorMessage = 'Email not sent: Your sender email is not verified with Brevo. Please verify it in your Brevo account.';
        }
        res.status(500).json({ success: false, message: errorMessage });
    }
};
