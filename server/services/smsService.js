const axios = require('axios');
require('dotenv').config();

/**
 * Send SMS using Arkesel API
 * @param {string} phoneNumber - Phone number in international format (e.g., 233544919953)
 * @param {string} message - SMS message to send
 * @returns {Promise<Object>} - Response from Arkesel API
 */
const sendSMS = async (phoneNumber, message) => {
  try {
    const apiKey = process.env.ARKSEL_APIKEY;
    const senderId = process.env.ARKSEL_SENDER_ID;

    if (!apiKey || !senderId) {
      throw new Error('Arkesel API key or Sender ID not configured in .env file');
    }

    // Format phone number - ensure it starts with country code (233 for Ghana)
    let formattedPhone = phoneNumber.trim().replace(/\s+/g, ''); // Remove all spaces
    
    // Remove leading zeros and ensure country code format
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '233' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('+')) {
      // Remove + if present
      formattedPhone = formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith('233') && !formattedPhone.startsWith('234')) {
      // If it doesn't start with a known country code, assume Ghana (233)
      formattedPhone = '233' + formattedPhone;
    }

    // Build API URL
    const apiUrl = 'https://sms.arkesel.com/sms/api';
    
    // Check if phone number is Nigerian (starts with 234)
    const isNigerian = formattedPhone.startsWith('234');
    
    // Build query parameters
    const params = new URLSearchParams({
      action: 'send-sms',
      api_key: apiKey,
      to: formattedPhone,
      from: senderId,
      sms: message
    });

    // Add use_case parameter for Nigerian numbers (required by Arkesel)
    if (isNigerian) {
      params.append('use_case', 'promotional');
    }

    const response = await axios.get(`${apiUrl}?${params.toString()}`, { timeout: 10000 });
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('SMS sending error:', error.message);
    // Return error but don't throw - allow the calling function to continue
    return {
      success: false,
      error: error.message,
      data: error.response?.data || null
    };
  }
};

/**
 * Send room allocation SMS to student
 * @param {string} studentName - Student's name
 * @param {string} phoneNumber - Student's phone number
 * @param {string} roomNumber - Allocated room number
 * @returns {Promise<Object>} - SMS sending result
 */
const sendRoomAllocationSMS = async (studentName, phoneNumber, roomNumber) => {
  const message = `Dear ${studentName}, you have been allocated Room ${roomNumber}. Please report to the hostel office for further instructions. Thank you.`;
  
  return await sendSMS(phoneNumber, message);
};

module.exports = {
  sendSMS,
  sendRoomAllocationSMS
};

