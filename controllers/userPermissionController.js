// backend/controllers/permissionController.js (Array-based permissions)
import UserModel from '../models/User.js';

// Available admin pages/routes
const AVAILABLE_PAGES = [
  'dashboard',
  'addEbooks', 
  'editEbooks',
  'addPremiumAccount',
  'addPremiumCodes',
  'manageUsers',
  'userPermissions',
  
];

// Get permissions for role
const getRolePermissions = (role, allowedPages = []) => {
  if (role === 'owner') {
    return AVAILABLE_PAGES; // Owners get all pages
  }
  if (role === 'employee') {
    return [ ...allowedPages]; // Employees get dashboard + allowed pages
  }
  return []; // Customers get nothing
};

// Get all employees with their allowed pages
export const getAllEmployeePermissions = async (req, res) => {
  try {
    const employees = await UserModel.find({ 
      role: 'employee',
      isAccountVerified: true 
    }).select('-password');

    const employeesWithPermissions = employees.map((employee) => {
      const allowedPages = employee.allowedPages;
      
      return {
        _id: employee._id,
        name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'N/A',
        email: employee.email,
        role: employee.role,
        allowedPages,
        availablePages: AVAILABLE_PAGES
      };
    });

    res.status(200).json({
      success: true,
      message: 'Employee permissions retrieved successfully',
      employees: employeesWithPermissions
    });
  } catch (error) {
    console.error("❌ Get Employee Permissions Error:", error);
    res.status(500).json({ success: false, message: 'Failed to retrieve employee permissions' });
  }
};

// Update employee allowed pages
export const updateEmployeePermissions = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { allowedPages } = req.body;

    const employee = await UserModel.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (employee.role !== 'employee') {
      return res.status(400).json({ success: false, message: 'Can only update permissions for employees' });
    }

    // Filter out invalid pages and never allow userPermissions for employees
    const validPages = allowedPages.filter(page => 
      AVAILABLE_PAGES.includes(page) && page !== 'userPermissions'
    );
    
   


    await UserModel.findByIdAndUpdate(
      employeeId, 
      { $set: { allowedPages: validPages } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Employee permissions updated successfully',
      allowedPages: validPages
    });
  } catch (error) {
    console.error("❌ Update Employee Permissions Error:", error);
    res.status(500).json({ success: false, message: 'Failed to update employee permissions' });
  }
};

// Get current user's allowed pages
export const getCurrentUserPermissions = async (req, res) => {
  try {
    const userId = req.user._id; // Use the correct ID from the authenticated user object
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let allowedPages;
    if (user.role === 'owner') {
      allowedPages = AVAILABLE_PAGES;
    } else if (user.role === 'employee') {
      allowedPages = user.allowedPages;
    } else {
      return res.status(200).json({ success: true, allowedPages: [], role: 'customer' }); // Return 'customer' role
    }

    res.status(200).json({
      success: true,
      allowedPages,
      role: user.role // NEW: Return the user's role
    });
  } catch (error) {
    console.error("❌ Get Current User Permissions Error:", error);
    res.status(500).json({ success: false, message: 'Failed to get user permissions' });
  }
};