const Fee = require('../models/fee');
const XLSX = require('xlsx');

const createFee = async (req, res) => {
  try {
    const { index_number, student_name, level, amount_paid, payment_method, date_paid, receipt_number } = req.body;

    // Validation
    if (!index_number || !student_name || !level || !amount_paid || !payment_method || !date_paid || !receipt_number) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate payment method
    const validPaymentMethods = ['GCB', 'CBG', 'CBG USSD'];
    if (!validPaymentMethods.includes(payment_method)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    // Check if receipt number already exists
    const existingFee = await Fee.findByReceiptNumber(receipt_number);
    if (existingFee) {
      return res.status(400).json({ error: 'Receipt number already exists' });
    }

    // Validate amount
    const amount = parseFloat(amount_paid);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    const feeId = await Fee.create({
      index_number,
      student_name,
      level,
      amount_paid: amount,
      payment_method,
      date_paid,
      receipt_number
    });

    res.json({ success: true, message: 'Fee payment recorded successfully', feeId });
  } catch (error) {
    console.error('Fee creation error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Receipt number already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

const getAllFees = async (req, res) => {
  try {
    const level = req.query.level || null;
    const receiptIssued = req.query.receipt_issued || null;
    const paymentMethod = req.query.payment_method || null;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const sortBy = req.query.sortBy || 'date_paid';
    const sortOrder = req.query.sortOrder || 'DESC';
    const result = await Fee.findAll(level, receiptIssued, paymentMethod, page, limit, sortBy, sortOrder, req.query.search || '');
    res.json({ 
      success: true, 
      fees: result.fees,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching fees:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getFeeStats = async (req, res) => {
  try {
    const stats = await Fee.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching fee stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getFeesByIndexNumber = async (req, res) => {
  try {
    const { index_number } = req.params;
    const fees = await Fee.findByIndexNumber(index_number);
    res.json({ success: true, fees });
  } catch (error) {
    console.error('Error fetching fees by index number:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getDistinctLevels = async (req, res) => {
  try {
    const levels = await Fee.getDistinctLevels();
    res.json({ success: true, levels });
  } catch (error) {
    console.error('Error fetching distinct levels:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const markReceiptIssued = async (req, res) => {
  try {
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Fee ID is required' });
    }

    await Fee.markReceiptIssued(id);
    res.json({ success: true, message: 'Receipt marked as issued successfully' });
  } catch (error) {
    console.error('Error marking receipt as issued:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Fee ID is required' });
    }

    const fee = await Fee.findById(id);
    if (!fee) {
      return res.status(404).json({ error: 'Fee payment not found' });
    }

    // Generate college receipt number if not already generated
    let collegeReceiptNumber = fee.college_receipt_number;
    if (!collegeReceiptNumber) {
      collegeReceiptNumber = await Fee.generateAndStoreCollegeReceipt(id);
      // Reload fee to get updated data
      const updatedFee = await Fee.findById(id);
      fee.college_receipt_number = updatedFee.college_receipt_number;
      fee.receipt_issued = updatedFee.receipt_issued;
      fee.receipt_issued_at = updatedFee.receipt_issued_at;
    }

    // Format date for display
    const datePaid = new Date(fee.date_paid).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const receiptIssuedDate = fee.receipt_issued_at 
      ? new Date(fee.receipt_issued_at).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      : datePaid;

    res.render('dashboards/receipt', {
      fee: fee,
      datePaid: datePaid,
      receiptIssuedDate: receiptIssuedDate
    });
  } catch (error) {
    console.error('Error fetching receipt:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const exportFeesToExcel = async (req, res) => {
  try {
    const level = req.query.level || null;
    const receiptIssued = req.query.receipt_issued || null;
    const paymentMethod = req.query.payment_method || null;
    const sortBy = req.query.sortBy || 'date_paid';
    const sortOrder = req.query.sortOrder || 'DESC';
    
    // Get fees with the same filters as getAllFees (no pagination for export)
    const result = await Fee.findAll(level, receiptIssued, paymentMethod, 1, 999999, sortBy, sortOrder, req.query.search || '');
    const fees = result.fees;
    
    // Prepare data for Excel
    const excelData = fees.map(fee => {
      const datePaid = new Date(fee.date_paid).toLocaleDateString('en-GB');
      const receiptIssuedAt = fee.receipt_issued_at 
        ? new Date(fee.receipt_issued_at).toLocaleDateString('en-GB')
        : 'Not issued';
      
      return {
        'Index Number': fee.index_number,
        'Student Name': fee.student_name,
        'Level': fee.level || 'N/A',
        'Amount Paid (GHS)': parseFloat(fee.amount_paid).toFixed(2),
        'Payment Method': fee.payment_method,
        'Date Paid': datePaid,
        'Bank Receipt Number': fee.receipt_number,
        'College Receipt Number': fee.college_receipt_number || 'Not issued',
        'Receipt Status': fee.receipt_issued ? 'Issued' : 'Pending',
        'Receipt Issued Date': receiptIssuedAt,
        'Created At': fee.created_at ? new Date(fee.created_at).toLocaleDateString('en-GB') : ''
      };
    });
    
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths
    const columnWidths = [
      { wch: 15 }, // Index Number
      { wch: 25 }, // Student Name
      { wch: 10 }, // Level
      { wch: 18 }, // Amount Paid
      { wch: 15 }, // Payment Method
      { wch: 12 }, // Date Paid
      { wch: 20 }, // Bank Receipt Number
      { wch: 25 }, // College Receipt Number
      { wch: 15 }, // Receipt Status
      { wch: 18 }, // Receipt Issued Date
      { wch: 12 }  // Created At
    ];
    worksheet['!cols'] = columnWidths;
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fee Payments');
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `Fee_Payments_${timestamp}.xlsx`;
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Write workbook to response
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting fees to Excel:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  createFee,
  getAllFees,
  getFeeStats,
  getFeesByIndexNumber,
  getDistinctLevels,
  markReceiptIssued,
  getReceipt,
  exportFeesToExcel
};

