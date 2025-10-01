export const dynamic = "force-dynamic";

import Link from "next/link";

import { api, AutomationDigest, Employee, TimeOffRequest } from "../../lib/api";

async function getEmployees(): Promise<Employee[]> {
  return api.employees();
}

async function getTimeOffRequests(): Promise<TimeOffRequest[]> {
  return api.hrTimeOff();
}

async function getAutomationDigest(): Promise<AutomationDigest> {
  return api.automationDigest();
}

export default async function PeoplePage(): Promise<JSX.Element> {
  const [employees, timeOff, digest] = await Promise.all([
    getEmployees(),
    getTimeOffRequests(),
    getAutomationDigest()
  ]);

  const timeOffActions = new Map<string, { label: string; url: string }>();
  digest.tasks.forEach((task) => {
    const requestId = task.related_ids?.time_off_request_id;
    if (!requestId) {
      return;
    }
    timeOffActions.set(requestId, {
      label: task.action_label ?? "Review",
      url: task.action_url ?? "/hr"
    });
  });

  const employeeNames = new Map<string, string>();
  employees.forEach((employee) => {
    employeeNames.set(employee.id, `${employee.first_name} ${employee.last_name}`);
  });

  return (
    <div>
      <h2 className="section-title">People & Capacity</h2>
      <p className="text-muted" style={{ maxWidth: "680px" }}>
        Centralized employee and contractor records with skill matrices and availability insights for staffing decisions.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Title</th>
            <th>Type</th>
            <th>Email</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id}>
              <td>
                {employee.first_name} {employee.last_name}
              </td>
              <td>{employee.title}</td>
              <td style={{ textTransform: "capitalize" }}>{employee.employment_type}</td>
              <td>{employee.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section style={{ marginTop: "2.5rem" }}>
        <h3 style={{ marginBottom: "0.5rem" }}>Pending time-off approvals</h3>
        <p className="text-muted" style={{ maxWidth: "640px" }}>
          Sync automation prompts with HR workflows so managers can approve leave without context switching.
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Team member</th>
              <th>Dates</th>
              <th>Status</th>
              <th>Quick action</th>
            </tr>
          </thead>
          <tbody>
            {timeOff.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", color: "#8c6f63" }}>
                  No upcoming leave requests.
                </td>
              </tr>
            ) : (
              timeOff.map((request) => (
                <tr key={request.id}>
                  <td>{employeeNames.get(request.employee_id) ?? request.employee_id}</td>
                  <td>
                    {new Date(request.start_date).toLocaleDateString()} – {new Date(request.end_date).toLocaleDateString()}
                  </td>
                  <td style={{ textTransform: "capitalize" }}>{request.status}</td>
                  <td>
                    {timeOffActions.has(request.id) ? (
                    <Link
                      href={timeOffActions.get(request.id)!.url}
                      style={{ color: "#8b3921", textDecoration: "none", fontWeight: 600 }}
                    >
                      {timeOffActions.get(request.id)!.label}
                    </Link>
                  ) : (
                    <span style={{ color: "#8c6f63" }}>—</span>
                  )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
