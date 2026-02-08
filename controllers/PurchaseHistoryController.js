import Order from "../models/Order.js";

/**
 * Fetches the purchase history for a logged-in user.
 * @param {import('express').Request} req The request object, with a populated `req.user`.
 * @param {import('express').Response} res The response object.
 */
export const getUserPurchases = async (req, res) => {
  try {
    const userEmail = req.user.email;


    // Find all successfully delivered orders for the user and populate the product data.
    // The 'select' option is now updated to fetch all necessary fields.
    const orders = await Order.find({
      email: userEmail,
      status: "delivered",
    }).populate({
      path: 'items.productId',
      select: 'name type author publisher platform duration thumbnailUrl description metadata', // NEW: Added description and metadata
    });

  
    const userPurchases = {
      books: [],
      premiumAccounts: [],
    };

    orders.forEach(order => {
      // Iterate through all items in the order and categorize them by type.
      order.items.forEach(item => {
        const productData = item.productId;
        
        // Ensure product data exists before proceeding.
        if (productData) {
          // Process Ebooks
          if (productData.type === 'ebook') {
            userPurchases.books.push({
              id: productData._id,
              title: productData.name,
              author: productData.author,
              publisher: productData.publisher,
              description: productData.description, // NEW: Added description
              thumbnailUrl: productData.thumbnailUrl,
              metadata: productData.metadata, // NEW: Added metadata object
              purchasedDate: new Date(order.delivered.at).toLocaleDateString(),
            });
          }
          // Process Premium Accounts
          else if (productData.type === 'premium_account') {
            userPurchases.premiumAccounts.push({
              id: productData._id,
              service: productData.name,
              platform: productData.platform,
              duration: productData.duration,
              description: productData.description, // NEW: Added description
              thumbnailUrl: productData.thumbnailUrl,
              status: "Active", // Assuming all delivered accounts are active
              renewalDate: new Date(new Date(order.delivered.at).setFullYear(new Date(order.delivered.at).getFullYear() + 1)).toLocaleDateString(),
              assignedAt: new Date(order.delivered.at).toLocaleDateString(),
            });
          }
        }
      });
    });
    

    res.status(200).json({ success: true, purchases: userPurchases });

  } catch (error) {
    console.error("Error fetching user purchases:", error);
    res.status(500).json({ success: false, message: "Failed to fetch purchases." });
  }
};
