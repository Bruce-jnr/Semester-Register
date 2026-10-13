const Student = require('../models/student');
const Room = require('../models/room');
const { sendRoomAllocationSMS } = require('../services/smsService');
const { setAccommodation } = require('../services/accommodation');
const XLSX = require('xlsx');
const { normalizeUniformFee } = require('../services/uniform-fee');
const uniformLabel = student => /^(?:level\s*)?100$/i.test(String(student.level).trim()) ? student.uniform_fee_status || 'Not recorded' : 'Not applicable';

const registerStudent = async (req, res) => {
  try {
    const { index_number, name, gender, program, level, phone, email, residence_type = 'Residential', uniform_fee_status } = req.body;
    if (!['Residential', 'Non-residential'].includes(residence_type)) return res.status(400).json({ error: 'Invalid residence type' });

    // Required fields validation
    if (!index_number || !name || !gender || !level || !phone) {
      return res.status(400).json({ error: 'Index Number, Name, Gender, Level, and Phone Number are required' });
    }

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'A valid student name is required' });
    }

    let uniformStatus;
    try { uniformStatus = normalizeUniformFee(level, uniform_fee_status); }
    catch (error) { return res.status(400).json({ error: error.message }); }

    // Program and email are optional, so we allow them to be empty/null
    const studentId = await Student.create({ 
      index_number, 
      name, 
      gender, 
      program: program || null, 
      level, 
      phone, 
      email: email || null,
      is_non_residential: residence_type === 'Non-residential',
      uniform_fee_status: uniformStatus 
    });
    res.json({ success: true, message: 'Student registered successfully', studentId });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Index number already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

const getAllStudents = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const gender = req.query.gender || null;
    const level = req.query.level || null;
    const result = await Student.findAll(page, limit, gender, level, req.query.search || '', req.query.room_number || null);
    res.json({ success: true, students: result.students, pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    }});
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getDistinctLevels = async (req, res) => {
  try {
    const levels = await Student.getDistinctLevels();
    res.json({ success: true, levels });
  } catch (error) {
    console.error('Error fetching distinct levels:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getDistinctRoomNumbers = async (req, res) => {
  try {
    const gender = req.query.gender || null;
    const roomNumbers = await Student.getDistinctRoomNumbers(gender);
    res.json({ success: true, roomNumbers });
  } catch (error) {
    console.error('Error fetching distinct room numbers:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getUnallocatedStudents = async (req, res) => {
  try {
    const gender = req.query.gender || null;
    const students = await Student.findUnallocated(gender);
    res.json({ success: true, students });
  } catch (error) {
    console.error('Error fetching unallocated students:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getStudentsByGender = async (req, res) => {
  try {
    const { gender } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const level = req.query.level || null;
    const roomNumber = req.query.room_number || null;
    const result = await Student.findByGender(gender, page, limit, level, roomNumber, req.query.search || '');
    res.json({ success: true, students: result.students, pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    }});
  } catch (error) {
    console.error('Error fetching students by gender:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const allocateRoom = async (req, res) => {
  try {
    const { studentId, roomId } = req.body;

    if (!studentId || !roomId) {
      return res.status(400).json({ error: 'Student ID and Room ID are required' });
    }

    let accommodation;
    try { accommodation = await setAccommodation(studentId, roomId); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    const { student, room, nonResidential } = accommodation;
    if (nonResidential) return res.json({ success: true, message: 'Student marked as non-residential' });

    // Send SMS notification (non-blocking - don't fail allocation if SMS fails)
    if (student && student.phone && student.name && room.room_number) {
      try {
        const smsResult = await sendRoomAllocationSMS(
          student.name,
          student.phone,
          room.room_number
        );
        
        if (smsResult.success) {
          console.log(`SMS sent successfully to ${student.name} (${student.phone})`);
        } else {
          console.error(`Failed to send SMS to ${student.name}:`, smsResult.error);
        }
      } catch (smsError) {
        // Log SMS error but don't fail the allocation
        console.error('SMS sending error (allocation still successful):', smsError);
      }
    } else {
      console.warn(`SMS not sent: missing student phone (${student?.phone}), name (${student?.name}), or room number (${room?.room_number})`);
    }

    res.json({ success: true, message: 'Room allocated successfully' });
  } catch (error) {
    console.error('Allocation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getStudentStats = async (req, res) => {
  try {
    const gender = req.query.gender || null;
    const stats = await Student.getStats(gender);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const exportStudentsToExcel = async (req, res) => {
  try {
    const gender = req.query.gender || null;
    const level = req.query.level || null;
    
    // Get all students with the same filters as getAllStudents
    const students = await Student.findAllForExport(gender, level, req.query.search || '', req.query.room_number || null);
    
    // Prepare data for Excel
    const excelData = students.map(student => {
      const createdAt = student.created_at 
        ? new Date(student.created_at).toLocaleDateString('en-GB')
        : '';
      
      return {
        'Index Number': student.index_number,
        'Student Name': student.name,
        'Gender': student.gender,
        'Program': student.program || 'N/A',
        'Level': student.level,
        'Uniform Fee': uniformLabel(student),
        'Phone': student.phone,
        'Email': student.email || 'N/A',
        'Room Number': student.is_non_residential ? 'Not applicable' : student.room_number || 'Not allocated',
        'Status': student.is_non_residential ? 'Non-residential' : student.room_number ? 'Allocated' : 'Awaiting a room',
        'Registered Date': createdAt
      };
    });
    
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths
    const columnWidths = [
      { wch: 15 }, // Index Number
      { wch: 25 }, // Student Name
      { wch: 10 }, // Gender
      { wch: 20 }, // Program
      { wch: 10 }, // Level
      { wch: 18 }, // Uniform Fee
      { wch: 15 }, // Phone
      { wch: 30 }, // Email
      { wch: 15 }, // Room Number
      { wch: 15 }, // Status
      { wch: 18 }  // Registered Date
    ];
    worksheet['!cols'] = columnWidths;
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Student Registrations');
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `Student_Registrations_${timestamp}.xlsx`;
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Write workbook to response
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting students to Excel:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const exportStudentsByGenderToExcel = async (req, res) => {
  try {
    const { gender } = req.params;
    const level = req.query.level || null;
    const roomNumber = req.query.room_number || null;
    
    // Get all students by gender with filters
    const students = await Student.findAllByGenderForExport(gender, level, roomNumber, req.query.search || '');
    
    // Prepare data for Excel
    const excelData = students.map(student => {
      const createdAt = student.created_at 
        ? new Date(student.created_at).toLocaleDateString('en-GB')
        : '';
      
      return {
        'Index Number': student.index_number,
        'Student Name': student.name,
        'Program': student.program || 'N/A',
        'Level': student.level,
        'Uniform Fee': uniformLabel(student),
        'Phone': student.phone,
        'Email': student.email || 'N/A',
        'Room Number': student.is_non_residential ? 'Not applicable' : student.room_number || 'Not allocated',
        'Status': student.is_non_residential ? 'Non-residential' : student.room_number ? 'Allocated' : 'Awaiting a room',
        'Registered Date': createdAt
      };
    });
    
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths
    const columnWidths = [
      { wch: 15 }, // Index Number
      { wch: 25 }, // Student Name
      { wch: 20 }, // Program
      { wch: 10 }, // Level
      { wch: 18 }, // Uniform Fee
      { wch: 15 }, // Phone
      { wch: 30 }, // Email
      { wch: 15 }, // Room Number
      { wch: 15 }, // Status
      { wch: 18 }  // Registered Date
    ];
    worksheet['!cols'] = columnWidths;
    
    // Add worksheet to workbook
    const genderLabel = gender === 'Male' ? 'Male Students' : 'Female Students';
    XLSX.utils.book_append_sheet(workbook, worksheet, genderLabel);
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `${genderLabel.replace(/\s+/g, '_')}_${timestamp}.xlsx`;
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Write workbook to response
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting students by gender to Excel:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateUniformFee = async (req, res) => {
  const id = Number(req.params.id);
  const status = req.body.uniform_fee_status;
  if (!Number.isInteger(id) || id <= 0 || !['Paid', 'Unpaid'].includes(status)) {
    return res.status(400).json({ error: 'A valid student and Paid or Unpaid status are required' });
  }
  try {
    const updated = await Student.updateUniformFee(id, status);
    if (updated === null) return res.status(404).json({ error: 'Student not found' });
    return res.json({ success: true, uniform_fee_status: updated });
  } catch (error) {
    if (error.message === 'Uniform fees apply only to Level 100 students') return res.status(400).json({ error: error.message });
    console.error('Uniform fee update error:', error.message);
    return res.status(500).json({ error: 'Could not update uniform fee status' });
  }
};

module.exports = {
  updateUniformFee,
  registerStudent,
  getAllStudents,
  getUnallocatedStudents,
  getStudentsByGender,
  getDistinctLevels,
  getDistinctRoomNumbers,
  allocateRoom,
  getStudentStats,
  exportStudentsToExcel,
  exportStudentsByGenderToExcel
};

