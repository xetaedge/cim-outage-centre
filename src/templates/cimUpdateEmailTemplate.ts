export function buildCimUpdateEmail(data: {
  updateSequence: string;
  incidentNumber: string;
  startDate: string;
  startTime: string;
  priority: string;
  incidentManager: string;
  nextUpdate: string;
  businessImpact: string;
  sitesImpacted: string;
  outageDuration: string;
  assignmentGroup: string;
  relatedIncidents: string;
  issueSummary: string;
  resolutionStatus: string;
  overallStatus: string;
  teamsInvolved: string;
  partnerLead: string;
  itCoordinator: string;
  stakeholders: string;
  teamsLink: string;
}): string {
  // Styles reused for uniformity
  const borderStyle = '1px solid #1a365d';
  const labelBg = '#2b557d';
  const labelColor = '#fff';
  const valBg = '#eaf2f8'; // very light blue
  const pRed = '#c92c4b'; // Priority Red

  return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #000; max-width: 900px; margin: 0 auto; border: 2px solid #2b557d;">
      
      <!-- Top Header -->
      <div style="display: flex; width: 100%;">
        <div style="background-color: #2b557d; color: #fff; width: 60%; padding: 20px; display: flex; align-items: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 1px;">PRIORITY INCIDENT UPDATE - ${data.updateSequence}</h1>
        </div>
        <div style="width: 40%; background-color: #fff; padding: 10px; display: flex; align-items: center; justify-content: center;">
          <div style="border: 2px solid #c92c4b; border-radius: 4px; padding: 5px 10px; font-weight: bold; color: #c92c4b; font-size: 18px;">
            CRITICAL INCIDENT <br/> MANAGEMENT TEAM
          </div>
        </div>
      </div>

      <!-- Main Data Table -->
      <table style="width: 100%; border-collapse: collapse; border-top: 2px solid #1a365d;">
        <!-- Row 1 -->
        <tr>
          <td style="background-color: ${labelBg}; color: ${labelColor}; padding: 8px; font-weight: bold; border: ${borderStyle}; width: 18%;">Incident No. :</td>
          <td style="background-color: ${valBg}; padding: 8px; border: ${borderStyle}; width: 22%; font-weight: bold;">${data.incidentNumber}</td>
          <td style="background-color: ${labelBg}; color: ${labelColor}; padding: 8px; font-weight: bold; border: ${borderStyle}; width: 15%;">Start Date:</td>
          <td style="background-color: ${valBg}; padding: 8px; border: ${borderStyle}; width: 15%;">${data.startDate}</td>
          <td style="background-color: ${labelBg}; color: ${labelColor}; padding: 8px; font-weight: bold; border: ${borderStyle}; width: 15%;">Start Time:</td>
          <td style="background-color: ${valBg}; padding: 8px; border: ${borderStyle}; width: 15%;">${data.startTime}</td>
        </tr>

        <!-- Row 2 -->
        <tr>
          <td style="background-color: ${pRed}; color: ${labelColor}; padding: 8px; font-weight: bold; border: ${borderStyle};">Priority :</td>
          <td style="background-color: #f7d2d7; padding: 8px; border: ${borderStyle}; font-weight: bold; color: ${pRed};">${data.priority}</td>
          <td style="background-color: ${labelBg}; color: ${labelColor}; padding: 8px; font-weight: bold; border: ${borderStyle};">Incident Manager:</td>
          <td style="background-color: ${valBg}; padding: 8px; border: ${borderStyle};">${data.incidentManager}</td>
          <td style="background-color: ${labelBg}; color: ${labelColor}; padding: 8px; font-weight: bold; border: ${borderStyle};">Next Update:</td>
          <td style="background-color: ${valBg}; padding: 8px; border: ${borderStyle};">${data.nextUpdate}</td>
        </tr>

        <!-- Row 3 -->
        <tr>
          <td style="background-color: ${labelBg}; color: ${labelColor}; padding: 8px; font-weight: bold; border: ${borderStyle};">Business Impact :</td>
          <td colspan="3" style="background-color: ${valBg}; padding: 8px; border: ${borderStyle};">${data.businessImpact}</td>
          <td style="background-color: ${labelBg}; color: ${labelColor}; padding: 8px; font-weight: bold; border: ${borderStyle};">Site(s) Impacted:</td>
          <td style="background-color: ${valBg}; padding: 8px; border: ${borderStyle};">${data.sitesImpacted}</td>
        </tr>

        <!-- Row 4 -->
        <tr>
          <td style="background-color: ${labelBg}; color: ${labelColor}; padding: 8px; font-weight: bold; border: ${borderStyle};">Total Outage Duration</td>
          <td colspan="3" style="background-color: ${valBg}; padding: 8px; border: ${borderStyle};">${data.outageDuration}</td>
          <td style="background-color: ${labelBg}; color: ${labelColor}; padding: 8px; font-weight: bold; border: ${borderStyle};">Incident Assignment Group :</td>
          <td style="background-color: ${valBg}; padding: 8px; border: ${borderStyle};">${data.assignmentGroup}</td>
        </tr>

        <!-- Row 5 -->
        <tr>
          <td style="background-color: ${labelBg}; color: ${labelColor}; padding: 8px; font-weight: bold; border: ${borderStyle};">Related Incidents (If any)</td>
          <td colspan="5" style="background-color: ${valBg}; padding: 8px; border: ${borderStyle};">${data.relatedIncidents}</td>
        </tr>

        <!-- Row 6 -->
        <tr>
          <td style="background-color: ${labelBg}; color: ${labelColor}; padding: 8px; font-weight: bold; border: ${borderStyle};">Issue Summary :</td>
          <td colspan="5" style="background-color: #fff; padding: 12px 8px; border: ${borderStyle};">${data.issueSummary}</td>
        </tr>

        <!-- Row 7 -->
        <tr>
          <td style="background-color: ${labelBg}; color: ${labelColor}; padding: 8px; font-weight: bold; border: ${borderStyle};">Resolution Status :</td>
          <td colspan="5" style="background-color: #fff; padding: 12px 8px; border: ${borderStyle};">${data.resolutionStatus}</td>
        </tr>

        <!-- Row 8 -->
        <tr>
          <td style="background-color: ${labelBg}; color: ${labelColor}; padding: 8px; font-weight: bold; border: ${borderStyle};">Overall Status and ETA (EST) :</td>
          <td colspan="5" style="background-color: #fff; padding: 12px 8px; border: ${borderStyle}; font-weight: bold;">${data.overallStatus}</td>
        </tr>

        <!-- Row 9 -->
        <tr>
          <td style="background-color: ${labelBg}; color: ${labelColor}; padding: 8px; font-weight: bold; border: ${borderStyle};">Teams Involved :</td>
          <td colspan="3" style="background-color: ${valBg}; padding: 8px; border: ${borderStyle};">${data.teamsInvolved}</td>
          <td style="background-color: ${labelBg}; color: ${labelColor}; padding: 8px; font-weight: bold; border: ${borderStyle};">Partner Lead :</td>
          <td style="background-color: #fff; padding: 8px; border: ${borderStyle};">${data.partnerLead}</td>
        </tr>

        <!-- Row 10 -->
        <tr>
          <td style="background-color: ${labelBg}; color: ${labelColor}; padding: 8px; font-weight: bold; border: ${borderStyle};">C&D IT Coordinator :</td>
          <td colspan="3" style="background-color: ${valBg}; padding: 8px; border: ${borderStyle};">${data.itCoordinator}</td>
          <td style="background-color: ${labelBg}; color: ${labelColor}; padding: 8px; font-weight: bold; border: ${borderStyle};">Stake Holders Informed :</td>
          <td style="background-color: #fff; padding: 8px; border: ${borderStyle};">${data.stakeholders}</td>
        </tr>

        <!-- War Room Header -->
        <tr>
          <td colspan="6" style="background-color: #c92c4b; color: #fff; text-align: center; padding: 8px; font-weight: bold; border: ${borderStyle};">
            War Room Details
          </td>
        </tr>

        <!-- War Room Row -->
        <tr>
          <td style="background-color: ${labelBg}; color: ${labelColor}; padding: 8px; font-weight: bold; border: ${borderStyle};">Teams Meeting Link :</td>
          <td colspan="5" style="background-color: #fff; padding: 8px; border: ${borderStyle};">
            <a href="${data.teamsLink}" style="color: #0000ee; text-decoration: underline;">Join Teams Meeting</a>
          </td>
        </tr>

      </table>
    </div>
  `;
}
