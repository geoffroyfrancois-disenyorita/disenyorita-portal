export const dynamic = "force-dynamic";

import { api, Employee } from "../../lib/api";

async function getEmployees(): Promise<Employee[]> {
  return api.employees();
}

export default async function PeoplePage(): Promise<JSX.Element> {
  const employees = await getEmployees();

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
    </div>
  );
}
