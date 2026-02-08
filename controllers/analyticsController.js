import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";

export const getDashboardAnalytics = async (req, res) => {
  try {
    // Get date ranges
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Get total counts
    const totalUsers = await User.countDocuments({ isAccountVerified: true });
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    
    // Calculate total revenue from all orders - FIXED
    const totalRevenueResult = await Order.aggregate([
      { $match: { status: { $in: ["completed", "paid", "delivered"] } } },
      { $group: { _id: null, total: { $sum: "$payment.amount" } } }
    ]);
    const totalRevenue = totalRevenueResult[0]?.total || 0;

    // Get today's stats
    const todayOrders = await Order.countDocuments({ 
      createdAt: { $gte: startOfToday },
      status: { $in: ["completed", "paid", "delivered"] }
    });
    
    const todayRevenueResult = await Order.aggregate([
      { 
        $match: { 
          status: { $in: ["completed", "paid", "delivered"] },
          createdAt: { $gte: startOfToday } 
        } 
      },
      { $group: { _id: null, total: { $sum: "$payment.amount" } } }
    ]);
    const todayRevenue = todayRevenueResult[0]?.total || 0;

    // Get monthly stats
    const monthlyOrders = await Order.countDocuments({ 
      createdAt: { $gte: startOfMonth },
      status: { $in: ["completed", "paid", "delivered"] }
    });
    
    const monthlyRevenueResult = await Order.aggregate([
      { 
        $match: { 
          status: { $in: ["completed", "paid", "delivered"] },
          createdAt: { $gte: startOfMonth } 
        } 
      },
      { $group: { _id: null, total: { $sum: "$payment.amount" } } }
    ]);
    const monthlyRevenue = monthlyRevenueResult[0]?.total || 0;

    // Get recent orders with full item details - FIXED to include email
    const recentOrders = await Order.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("userId", "firstName lastName email");

    // Get sales data for charts - Group by month for the past 12 months
    const salesData = [];
    
    for (let i = 0; i < 12; i++) {
      const startDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const endDate = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
      
      const monthData = await Order.aggregate([
        {
          $match: {
            status: { $in: ["completed", "paid", "delivered"] },
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 }
          }
        }
      ]);
      
      salesData.push({
        date: startDate.toISOString().split('T')[0],
        orders: monthData[0]?.totalOrders || 0
      });
    }
    
    // Reverse to show chronological order
    salesData.reverse();

    // Calculate user growth (placeholder)
    const userGrowth = 12;

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalProducts,
          totalOrders,
          totalRevenue
        },
        today: {
          orders: todayOrders,
          revenue: todayRevenue,
          userGrowth
        },
        monthly: {
          orders: monthlyOrders,
          revenue: monthlyRevenue
        },
        recentOrders,
        salesData
      }
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch analytics data"
    });
  }
};