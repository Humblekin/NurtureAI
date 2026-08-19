export function buildPatientNameLookup(mothers = [], children = []) {
  const map = new Map();
  mothers.forEach((m) => {
    if (m?.id) map.set(m.id, { name: m.full_name, type: 'mother' });
  });
  children.forEach((c) => {
    if (c?.id) map.set(c.id, { name: c.full_name, type: 'child' });
  });
  return (patientId) => map.get(patientId) || null;
}

export default buildPatientNameLookup;
