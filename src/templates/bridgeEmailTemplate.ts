export function buildBridgeEmail(data: {
  incidentNumber: string;
  priority: string;
  location: string;
  shortDescription: string;
  teamsBridgeLink: string;
  conferenceId: string;
}): string {
  return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #000; max-width: 800px; margin: 0 auto;">
      <p>Hi All,</p>
      <p>Please find the below bridge details:</p>

      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; margin-top: 15px;">
        <!-- Header Row -->
        <tr>
          <td colspan="4" style="background-color: #2b557d; color: #fff; padding: 15px; border-bottom: 1px solid #000;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h2 style="margin: 0; font-size: 24px; font-weight: bold;">Priority Incident Bridge Details</h2>
              <div style="background-color: #fff; color: #000; padding: 5px 15px; border-radius: 4px; font-weight: bold;">
                <span style="color: #d12133;">CRITICAL</span> INCIDENT
              </div>
            </div>
          </td>
        </tr>

        <!-- Details Row 1 -->
        <tr style="background-color: #dbe4ee;">
          <td style="background-color: #2b557d; color: #fff; padding: 8px; font-weight: bold; width: 20%; border: 1px solid #000;">Incident Number :</td>
          <td style="padding: 8px; border: 1px solid #000; background-color: #f2f2f2; width: 30%;">${data.incidentNumber}</td>
          <td style="background-color: #2b557d; color: #fff; padding: 8px; font-weight: bold; width: 15%; border: 1px solid #000;">Priority :</td>
          <td style="padding: 8px; border: 1px solid #000; background-color: #f2f2f2; width: 35%;">${data.priority}</td>
        </tr>

        <!-- Details Row 2 -->
        <tr>
          <td style="background-color: #2b557d; color: #fff; padding: 8px; font-weight: bold; border: 1px solid #000;">Location :</td>
          <td colspan="3" style="padding: 8px; border: 1px solid #000; background-color: #e6e6e6;">${data.location}</td>
        </tr>

        <!-- Details Row 3 -->
        <tr>
          <td style="background-color: #2b557d; color: #fff; padding: 8px; font-weight: bold; border: 1px solid #000;">Criticality Description :</td>
          <td colspan="3" style="padding: 8px; border: 1px solid #000; background-color: #fff;">${data.shortDescription}</td>
        </tr>

        <!-- CTA Header -->
        <tr>
          <td colspan="4" style="background-color: #c92c4b; color: #fff; text-align: center; padding: 8px; font-weight: bold; border: 1px solid #000;">
            Click on the below Link to Join & Collaborate on the Priority issue
          </td>
        </tr>

        <!-- CTA Link -->
        <tr>
          <td colspan="4" style="background-color: #fff; text-align: center; padding: 15px; border: 1px solid #000;">
            <a href="${data.teamsBridgeLink}" style="color: #0000ee; font-size: 20px; font-weight: bold; text-decoration: underline;">Join the meeting now</a>
          </td>
        </tr>

        <!-- Phone Bridge Header -->
        <tr>
          <td colspan="4" style="background-color: #2b557d; color: #fff; text-align: center; padding: 8px; font-weight: bold; border: 1px solid #000;">
            Join Teams Meeting via Phone
          </td>
        </tr>

        <!-- Phone Columns Header -->
        <tr style="background-color: #2b557d; color: #fff;">
          <td style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000; width: 30%;" colspan="2">Country/Region</td>
          <td style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000; width: 40%; white-space: nowrap;">Dial In Numbers</td>
          <td style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000; width: 30%;">Conference ID</td>
        </tr>

        <!-- Phone Numbers Row 1 -->
        <tr style="background-color: #f2f2f2;">
          <td colspan="2" style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000;">United States</td>
          <td style="padding: 8px; text-align: center; border: 1px solid #000; white-space: nowrap;">+1 (347) 841-0229</td>
          <td rowspan="6" style="padding: 15px; text-align: center; font-size: 22px; font-weight: normal; border: 1px solid #000; background-color: #fff;">
            &lt;${data.conferenceId || 'Meeting ID'}&gt;
          </td>
        </tr>
        
        <!-- Phone Numbers Row 2 -->
        <tr style="background-color: #e6e6e6;">
          <td colspan="2" style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000;">Canada</td>
          <td style="padding: 8px; text-align: center; border: 1px solid #000; white-space: nowrap;">+1 (647) 749-9197</td>
        </tr>
        
        <!-- Phone Numbers Row 3 -->
        <tr style="background-color: #f2f2f2;">
          <td colspan="2" style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000;">United Kingdom</td>
          <td style="padding: 8px; text-align: center; border: 1px solid #000; white-space: nowrap;">+44 (20) 34439851</td>
        </tr>
        
        <!-- Phone Numbers Row 4 -->
        <tr style="background-color: #e6e6e6;">
          <td colspan="2" style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000;">India</td>
          <td style="padding: 8px; text-align: center; border: 1px solid #000; white-space: nowrap;">+91 (22) 60014406</td>
        </tr>
        
        <!-- Phone Numbers Row 5 -->
        <tr style="background-color: #f2f2f2;">
          <td colspan="2" style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000;">Mexico</td>
          <td style="padding: 8px; text-align: center; border: 1px solid #000; white-space: nowrap;">+52 (55) 88744900</td>
        </tr>
        
        <!-- Phone Numbers Row 6 -->
        <tr style="background-color: #e6e6e6;">
          <td colspan="2" style="padding: 8px; text-align: center; font-weight: bold; border: 1px solid #000;">France</td>
          <td style="padding: 8px; text-align: center; border: 1px solid #000; white-space: nowrap;">+33 (173) 240397</td>
        </tr>

        <!-- Find local number -->
        <tr>
          <td colspan="4" style="background-color: #e6e6e6; text-align: center; padding: 8px; border: 1px solid #000;">
            <a href="#" style="color: #0000ee; text-decoration: underline;">Find a local number</a>
          </td>
        </tr>
      </table>

      <p style="margin-top: 20px; font-weight: bold;">
        Thanks and Regards,<br/>
        ICC Team
      </p>
    </div>
  `;
}
