export const dynamic = "force-dynamic";

import { api, Campaign } from "../../lib/api";

async function getCampaigns(): Promise<Campaign[]> {
  return api.campaigns();
}

export default async function MarketingPage(): Promise<JSX.Element> {
  const campaigns = await getCampaigns();

  return (
    <div>
      <h2 className="section-title">Marketing Operations</h2>
      <p className="text-muted" style={{ maxWidth: "680px" }}>
        Editorial calendar connects brand assets, scheduled posts, and attribution metrics to keep both teams in sync.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Campaign</th>
            <th>Objective</th>
            <th>Channel</th>
            <th>Owner</th>
            <th>Start</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr key={campaign.id}>
              <td>{campaign.name}</td>
              <td>{campaign.objective}</td>
              <td style={{ textTransform: "capitalize" }}>{campaign.channel}</td>
              <td>{campaign.owner_id}</td>
              <td>{new Date(campaign.start_date).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
