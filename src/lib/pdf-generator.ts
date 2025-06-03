import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { CertificateGrade, CourseLevel } from '@prisma/client';

interface CertificateData {
  courseName: string;
  courseLevel: CourseLevel;
  studentName: string;
  completionDate: string;
  certificateNumber: string;
  grade: CertificateGrade;
  finalScore: number;
  finalExamScore?: number; // Make optional since existing certificates might not have this
  engagementScore: number;
  quizAverage: number;
  timeInvested: number;
  instructorName: string;
}

export async function generateCertificatePDF(certificateData: CertificateData): Promise<void> {
  const {
    courseName,
    courseLevel,
    studentName,
    completionDate,
    certificateNumber,
    grade,
    finalScore,
    finalExamScore,
    engagementScore,
    quizAverage,
    timeInvested,
    instructorName
  } = certificateData;

  // Create PDF in landscape orientation
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // A4 landscape dimensions: 297mm x 210mm
  const pageWidth = 297;
  const pageHeight = 210;

  // Set up colors based on grade
  const gradeColors = {
    GOLD: { primary: '#F59E0B', secondary: '#FCD34D', bg: '#FFFBEB' },
    SILVER: { primary: '#6B7280', secondary: '#9CA3AF', bg: '#F9FAFB' },
    BRONZE: { primary: '#EA580C', secondary: '#FB923C', bg: '#FFF7ED' }
  };

  const colors = gradeColors[grade] || gradeColors.BRONZE;

  // Background
  pdf.setFillColor(colors.bg);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');

  // Border
  pdf.setDrawColor(colors.primary);
  pdf.setLineWidth(2);
  pdf.rect(10, 10, pageWidth - 20, pageHeight - 20);

  // Inner decorative border
  pdf.setDrawColor(colors.secondary);
  pdf.setLineWidth(0.5);
  pdf.rect(15, 15, pageWidth - 30, pageHeight - 30);

  // Header - Certificate Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(28); // Slightly smaller
  pdf.setTextColor(colors.primary);
  pdf.text('Certificate of Completion', pageWidth / 2, 30, { align: 'center' });

  // Grade badge
  pdf.setFillColor(colors.primary);
  pdf.roundedRect(pageWidth / 2 - 25, 38, 50, 12, 3, 3, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`${grade} GRADE`, pageWidth / 2, 46, { align: 'center' });

  // Award icon area (simple decoration)
  pdf.setDrawColor(colors.primary);
  pdf.setLineWidth(3);
  pdf.circle(pageWidth / 2, 65, 10); // Smaller circle
  pdf.setFillColor(colors.secondary);
  pdf.circle(pageWidth / 2, 65, 6, 'F');

  // "This is to certify that" text
  pdf.setTextColor(100, 100, 100);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  pdf.text('This is to certify that', pageWidth / 2, 85, { align: 'center' });

  // Student name
  pdf.setTextColor(50, 50, 50);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22); // Slightly smaller
  pdf.text(studentName, pageWidth / 2, 100, { align: 'center' });

  // "has successfully completed" text
  pdf.setTextColor(100, 100, 100);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  pdf.text('has successfully completed the course', pageWidth / 2, 115, { align: 'center' });

  // Course name
  pdf.setTextColor(50, 50, 50);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18); // Slightly smaller
  pdf.text(courseName, pageWidth / 2, 130, { align: 'center' });

  // Course level badge
  const levelColors = {
    BEGINNER: '#10B981',
    INTERMEDIATE: '#F59E0B', 
    ADVANCED: '#EF4444'
  };
  pdf.setFillColor(levelColors[courseLevel] || levelColors.BEGINNER);
  pdf.roundedRect(pageWidth / 2 - 20, 135, 40, 8, 2, 2, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.text(`${courseLevel} LEVEL`, pageWidth / 2, 141, { align: 'center' });

  // Achievement metrics in a grid
  const metricsY = 155; // Moved up more
  const metrics = [
    { label: 'Final Score', value: `${finalScore}%` },
    ...(finalExamScore ? [{ label: 'Final Exam', value: `${finalExamScore}%` }] : []),
    { label: 'Quiz Average', value: `${quizAverage}%` },
    { label: 'Engagement', value: `${engagementScore}%` },
    { label: 'Time Invested', value: `${timeInvested}h` }
  ];

  const metricWidth = 50;
  const startX = (pageWidth - (metricWidth * metrics.length)) / 2;

  metrics.forEach((metric, index) => {
    const x = startX + (index * metricWidth);
    
    // Value
    pdf.setTextColor(50, 50, 50);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text(metric.value, x + metricWidth/2, metricsY, { align: 'center' });
    
    // Label
    pdf.setTextColor(100, 100, 100);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(metric.label, x + metricWidth/2, metricsY + 6, { align: 'center' });
  });

  // Bottom section with details
  const bottomY = 175; // Moved up more to fit within page
  
  // Date
  pdf.setTextColor(100, 100, 100);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('Date of Completion', 50, bottomY);
  pdf.setFont('helvetica', 'normal');
  pdf.text(new Date(completionDate).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }), 50, bottomY + 5);

  // Certificate Number
  pdf.setFont('helvetica', 'bold');
  pdf.text('Certificate Number', pageWidth / 2, bottomY, { align: 'center' });
  pdf.setFont('courier', 'normal');
  pdf.setFontSize(9);
  pdf.text(certificateNumber, pageWidth / 2, bottomY + 5, { align: 'center' });

  // Instructor
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('Instructor', pageWidth - 50, bottomY, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.text(instructorName, pageWidth - 50, bottomY + 5, { align: 'center' });

  // Download the PDF
  pdf.save(`certificate-${courseName.replace(/[^a-zA-Z0-9]/g, '-')}-${studentName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
}

export async function generateCertificatePDFFromElement(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Certificate element not found');
  }

  try {
    // Create canvas from the element
    const canvas = await html2canvas(element, {
      scale: 2, // Higher quality
      useCORS: true,
      allowTaint: true,
      backgroundColor: null
    });

    // Create PDF in landscape orientation
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Calculate dimensions to fit the canvas in the PDF
    const imgWidth = 297; // A4 landscape width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Add image to PDF
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

    // Download the PDF
    pdf.save(filename);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
  }
}