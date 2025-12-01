import React, { useState, useMemo } from "react";

/* =========================
   MOCK FHIR-LIKE DATA
   ========================= */

const mockPatients = [
  {
    id: "patient-1",
    resourceType: "Patient",
    name: [{ given: ["Jane"], family: "Doe" }],
    gender: "female",
    birthDate: "1965-04-12",
  },
  {
    id: "patient-2",
    resourceType: "Patient",
    name: [{ given: ["John"], family: "Smith" }],
    gender: "male",
    birthDate: "1978-09-02",
  },
];

const mockConditions = [
  {
    id: "cond-1",
    resourceType: "Condition",
    subject: { reference: "Patient/patient-1" },
    code: {
      coding: [{ display: "Diabetes mellitus type 2" }],
    },
    clinicalStatus: { text: "active" },
  },
  {
    id: "cond-2",
    resourceType: "Condition",
    subject: { reference: "Patient/patient-1" },
    code: {
      coding: [{ display: "Hypertensive disorder" }],
    },
    clinicalStatus: { text: "active" },
  },
];

const mockEncounters = [
  {
    id: "enc-1",
    resourceType: "Encounter",
    subject: { reference: "Patient/patient-1" },
    period: { start: "2024-05-01" },
    type: [{ text: "Annual wellness visit" }],
  },
  {
    id: "enc-2",
    resourceType: "Encounter",
    subject: { reference: "Patient/patient-1" },
    period: { start: "2023-02-15" },
    type: [{ text: "Office visit" }],
  },
];

const mockObservations = [
  {
    id: "obs-1",
    resourceType: "Observation",
    subject: { reference: "Patient/patient-1" },
    effectiveDateTime: "2024-05-01",
    code: { text: "Blood pressure" },
    valueString: "140/92",
  },
  {
    id: "obs-2",
    resourceType: "Observation",
    subject: { reference: "Patient/patient-1" },
    effectiveDateTime: "2023-01-04",
    code: { text: "Hemoglobin A1c" },
    valueQuantity: { value: 8.2, unit: "%" },
  },
  {
    id: "obs-3",
    resourceType: "Observation",
    subject: { reference: "Patient/patient-1" },
    effectiveDateTime: "2022-01-10",
    code: { text: "Hemoglobin A1c" },
    valueQuantity: { value: 7.5, unit: "%" },
  },
];

const mockImmunizations = [
  {
    id: "imm-1",
    resourceType: "Immunization",
    patient: { reference: "Patient/patient-1" },
    occurrenceDateTime: "2022-10-01",
    vaccineCode: { text: "Influenza, seasonal" },
  },
];

/* =========================
   UTILITIES
   ========================= */

function getPatientDisplayName(patient) {
  if (!patient || !patient.name || patient.name.length === 0) return "Unknown";
  const n = patient.name[0];
  const given = n.given && n.given.length > 0 ? n.given[0] : "";
  const family = n.family || "";
  return (given + " " + family).trim();
}

function getAge(birthDate) {
  if (!birthDate) return null;
  const dob = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

// Format FHIR date (YYYY-MM-DD) without timezone shifting
function formatFHIRDate(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day)) return dateStr;
  return month + "/" + day + "/" + year;
}

// HL7 YYYYMMDD[hhmmss] -> FHIR YYYY-MM-DD
function hl7DateToFhirDate(hl7) {
  if (!hl7) return null;
  const trimmed = hl7.trim();
  if (trimmed.length < 8) return null;
  const year = trimmed.slice(0, 4);
  const month = trimmed.slice(4, 6);
  const day = trimmed.slice(6, 8);
  return year + "-" + month + "-" + day;
}

function getPatientResourcesFromMocks(patientId) {
  const ref = "Patient/" + patientId;
  return {
    conditions: mockConditions.filter(
      (c) => c.subject && c.subject.reference === ref
    ),
    encounters: mockEncounters.filter(
      (e) => e.subject && e.subject.reference === ref
    ),
    observations: mockObservations.filter(
      (o) => o.subject && o.subject.reference === ref
    ),
    immunizations: mockImmunizations.filter(
      (i) => i.patient && i.patient.reference === ref
    ),
  };
}

/* =========================
   CARE GAP ENGINE
   ========================= */

function findLatestObservation(observations, codeText) {
  const relevant = observations.filter(
    (o) => o.code && o.code.text === codeText
  );
  relevant.sort(
    (a, b) =>
      new Date(b.effectiveDateTime).getTime() -
      new Date(a.effectiveDateTime).getTime()
  );
  return relevant[0];
}

function monthsBetween(d1, d2) {
  const years = d2.getFullYear() - d1.getFullYear();
  const months = d2.getMonth() - d1.getMonth();
  return years * 12 + months;
}

function calculateCareGaps(patient, resources) {
  if (!patient || !resources) return [];
  const gaps = [];
  const now = new Date();
  const age = getAge(patient.birthDate);
  const conditions = resources.conditions || [];
  const encounters = resources.encounters || [];
  const observations = resources.observations || [];

  const hasDiabetes = conditions.some((c) => {
    const codes = (c.code && c.code.coding) || [];
    return codes.some(
      (cd) =>
        cd.display &&
        cd.display.toLowerCase().indexOf("diabetes") !== -1
    );
  });

  const hasHypertension = conditions.some((c) => {
    const codes = (c.code && c.code.coding) || [];
    return codes.some(
      (cd) =>
        cd.display &&
        cd.display.toLowerCase().indexOf("hyper") !== -1
    );
  });

  // A1c
  if (hasDiabetes) {
    const latestA1c = findLatestObservation(observations, "Hemoglobin A1c");
    if (!latestA1c) {
      gaps.push({
        id: "gap-a1c-none",
        label: "No historical A1c found for diabetic patient",
        severity: "high",
        recommendation: "Order Hemoglobin A1c test.",
      });
    } else {
      const last = new Date(latestA1c.effectiveDateTime);
      const months = monthsBetween(last, now);
      if (months > 12) {
        gaps.push({
          id: "gap-a1c-stale",
          label: "Last A1c was " + months + " months ago",
          severity: "high",
          lastDate: latestA1c.effectiveDateTime,
          recommendation: "Order repeat A1c; patient is overdue.",
        });
      }
    }
  }

  // Blood pressure
  if (hasHypertension) {
    const latestBP = findLatestObservation(observations, "Blood pressure");
    if (!latestBP) {
      gaps.push({
        id: "gap-bp-none",
        label: "No blood pressure readings for hypertensive patient",
        severity: "medium",
        recommendation:
          "Record blood pressure at next encounter or schedule a nurse visit.",
      });
    } else {
      const last = new Date(latestBP.effectiveDateTime);
      const months = monthsBetween(last, now);
      if (months > 6) {
        gaps.push({
          id: "gap-bp-stale",
          label: "Last BP was " + months + " months ago",
          severity: "medium",
          lastDate: latestBP.effectiveDateTime,
          recommendation: "Schedule follow-up BP check.",
        });
      }
    }
  }

  // Mammogram (female 50–74)
  if (patient.gender === "female" && age >= 50 && age <= 74) {
    const hasMammo = observations.some(
      (o) => o.code && o.code.text === "Mammogram"
    );
    if (!hasMammo) {
      gaps.push({
        id: "gap-mammo-none",
        label: "No mammogram on record (age 50–74)",
        severity: "medium",
        recommendation: "Order screening mammogram.",
      });
    }
  }

  // Annual Wellness Visit
  const awvEncounters = encounters.filter((e) => {
    const types = e.type || [];
    return types.some(
      (t) => t.text && t.text.toLowerCase().indexOf("annual") !== -1
    );
  });
  awvEncounters.sort(
    (a, b) =>
      new Date(b.period.start).getTime() -
      new Date(a.period.start).getTime()
  );
  const latestAWV = awvEncounters[0];

  if (!latestAWV) {
    gaps.push({
      id: "gap-awv-none",
      label: "No annual wellness visit on record",
      severity: "low",
      recommendation: "Schedule an annual wellness visit.",
    });
  } else {
    const last = new Date(latestAWV.period.start);
    const months = monthsBetween(last, now);
    if (months > 12) {
      gaps.push({
        id: "gap-awv-stale",
        label: "Last annual wellness visit was " + months + " months ago",
        severity: "low",
        lastDate: latestAWV.period.start,
        recommendation: "Schedule next annual wellness visit.",
      });
    }
  }

  return gaps;
}

/* =========================
   TIMELINE
   ========================= */

function buildTimeline(resources) {
  const events = [];
  const encounters = resources.encounters || [];
  const observations = resources.observations || [];
  const immunizations = resources.immunizations || [];

  encounters.forEach((e) => {
    if (e.period && e.period.start) {
      events.push({
        id: "enc-" + e.id,
        date: e.period.start,
        type: "Encounter",
        label: (e.type && e.type[0] && e.type[0].text) || "Encounter",
      });
    }
  });

  observations.forEach((o) => {
    if (o.effectiveDateTime) {
      events.push({
        id: "obs-" + o.id,
        date: o.effectiveDateTime,
        type: "Observation",
        label: (o.code && o.code.text) || "Observation",
      });
    }
  });

  immunizations.forEach((i) => {
    if (i.occurrenceDateTime) {
      events.push({
        id: "imm-" + i.id,
        date: i.occurrenceDateTime,
        type: "Immunization",
        label:
          (i.vaccineCode && i.vaccineCode.text) || "Immunization",
      });
    }
  });

  events.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  return events;
}

/* =========================
   PARSE FHIR BUNDLE (UPLOAD)
   ========================= */

function parseFHIRBundle(bundle) {
  const entries = Array.isArray(bundle.entry) ? bundle.entry : [];
  const resources = entries
    .map((e) => e.resource)
    .filter((r) => r && r.resourceType);

  const patients = resources.filter((r) => r.resourceType === "Patient");
  if (patients.length === 0) {
    throw new Error("No Patient resource found in bundle.");
  }

  const patient = patients[0];
  const ref = "Patient/" + patient.id;

  const conditions = resources.filter(
    (r) =>
      r.resourceType === "Condition" &&
      r.subject &&
      r.subject.reference === ref
  );
  const encounters = resources.filter(
    (r) =>
      r.resourceType === "Encounter" &&
      r.subject &&
      r.subject.reference === ref
  );
  const observations = resources.filter(
    (r) =>
      r.resourceType === "Observation" &&
      r.subject &&
      r.subject.reference === ref
  );
  const immunizations = resources.filter(
    (r) =>
      r.resourceType === "Immunization" &&
      ((r.patient && r.patient.reference === ref) ||
        (r.subject && r.subject.reference === ref))
  );

  return {
    patient,
    resources: {
      conditions,
      encounters,
      observations,
      immunizations,
    },
  };
}

/* =========================
   HL7 → FHIR PARSER
   ========================= */

function parseHl7ToObservation(hl7Text, patientId) {
  if (!hl7Text) {
    throw new Error("Empty HL7 message.");
  }

  const lines = hl7Text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const mshLine = lines.find((l) => l.startsWith("MSH"));
  const obxLine = lines.find((l) => l.startsWith("OBX|"));
  if (!obxLine) {
    throw new Error("No OBX segment found in HL7 message.");
  }

  const obxFields = obxLine.split("|");
  const obx3 = obxFields[3] || "";
  const obx5 = obxFields[5] || "";
  const obx6 = obxFields[6] || "";
  const obx14 = obxFields[14] || ""; // observation datetime

  // OBX-3 often: ^HBA1C^Hemoglobin A1c – pick last non-empty component
  let display = obx3;
  const obx3Parts = obx3.split("^").filter((p) => p.length > 0);
  if (obx3Parts.length > 0) {
    display = obx3Parts[obx3Parts.length - 1];
  }

  let effective = hl7DateToFhirDate(obx14);
  if (!effective && mshLine) {
    const mshFields = mshLine.split("|");
    const msh7 = mshFields[6] || "";
    effective = hl7DateToFhirDate(msh7);
  }
  if (!effective) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    effective = year + "-" + month + "-" + day;
  }

  const id = "hl7-obs-" + Math.random().toString(36).slice(2);

  const obs = {
    id: id,
    resourceType: "Observation",
    subject: { reference: "Patient/" + patientId },
    effectiveDateTime: effective,
    code: { text: display || "HL7 Observation" },
  };

  if (obx5) {
    obs.valueString = obx5 + (obx6 ? " " + obx6 : "");
  }

  return obs;
}

/* =========================
   SMALL UI HELPERS
   ========================= */

function Badge({ children, variant }) {
  let base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
  let color = " bg-gray-200 text-gray-800";
  if (variant === "high") color = " bg-red-200 text-red-800";
  else if (variant === "medium") color = " bg-yellow-200 text-yellow-800";
  else if (variant === "low") color = " bg-green-200 text-green-800";
  return <span className={base + color}>{children}</span>;
}

function Card({ title, children }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow">
      {title && <h2 className="text-sm font-semibold mb-2">{title}</h2>}
      {children}
    </div>
  );
}

/* =========================
   MAIN APP
   ========================= */

function App() {
  const [selectedPatientId, setSelectedPatientId] = useState(
    mockPatients[0].id
  );
  const [uploadedPatient, setUploadedPatient] = useState(null);
  const [uploadedResources, setUploadedResources] = useState(null);

  // HL7 ingestion state
  const [hl7Raw, setHl7Raw] = useState("");
  const [hl7MappedObservation, setHl7MappedObservation] = useState(null);
  const [hl7ObservationByPatient, setHl7ObservationByPatient] = useState({});
  const [hl7Error, setHl7Error] = useState(null);

  const patientOptions = useMemo(() => {
    const list = mockPatients.slice();
    if (uploadedPatient && !list.some((p) => p.id === uploadedPatient.id)) {
      list.push(uploadedPatient);
    }
    return list;
  }, [uploadedPatient]);

  const activePatient = useMemo(() => {
    if (uploadedPatient && selectedPatientId === uploadedPatient.id) {
      return uploadedPatient;
    }
    const found = patientOptions.find((p) => p.id === selectedPatientId);
    return found || patientOptions[0];
  }, [selectedPatientId, uploadedPatient, patientOptions]);

  const activeResources = useMemo(() => {
    let base;
    if (
      uploadedPatient &&
      uploadedResources &&
      selectedPatientId === uploadedPatient.id
    ) {
      base = uploadedResources;
    } else {
      base = getPatientResourcesFromMocks(selectedPatientId);
    }

    const hl7ObsForPatient =
      hl7ObservationByPatient[selectedPatientId] || [];

    return {
      conditions: base.conditions || [],
      encounters: base.encounters || [],
      observations: [...(base.observations || []), ...hl7ObsForPatient],
      immunizations: base.immunizations || [],
    };
  }, [
    selectedPatientId,
    uploadedPatient,
    uploadedResources,
    hl7ObservationByPatient,
  ]);

  const careGaps = useMemo(
    () => calculateCareGaps(activePatient, activeResources),
    [activePatient, activeResources]
  );
  const timeline = useMemo(
    () => buildTimeline(activeResources),
    [activeResources]
  );
  const age = getAge(activePatient.birthDate);

  // Single upload handler for both JSON (FHIR Bundle) and HL7 text
  const handleUniversalUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
      const text = evt.target.result;

      // Try FHIR Bundle JSON first
      try {
        const json = JSON.parse(text);
        if (json && json.resourceType === "Bundle") {
          const parsed = parseFHIRBundle(json);
          setUploadedPatient(parsed.patient);
          setUploadedResources(parsed.resources);
          setSelectedPatientId(parsed.patient.id);
          setHl7Error(null);
          alert("FHIR bundle loaded successfully.");
          return;
        }
        // If it's JSON but not a Bundle, fall through to HL7 handling
      } catch (err) {
        // Not valid JSON → treat as HL7
      }

      // Treat as HL7 v2 message
      try {
        const obs = parseHl7ToObservation(text, selectedPatientId);
        setHl7Raw(text);
        setHl7MappedObservation(obs);
        setHl7Error(null);
        setHl7ObservationByPatient((prev) => {
          const existing = prev[selectedPatientId] || [];
          return {
            ...prev,
            [selectedPatientId]: [...existing, obs],
          };
        });
        alert("HL7 message ingested and mapped to FHIR Observation.");
      } catch (err) {
        console.error(err);
        setHl7Error(err.message || "Failed to parse HL7 message.");
        alert("Could not parse file as FHIR Bundle or HL7 message.");
      }
    };
    reader.readAsText(file);
  };

  const usingUploaded =
    uploadedPatient && selectedPatientId === uploadedPatient.id;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto flex flex-col gap-4">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              Patient Timeline &amp; Care Gaps
            </h1>
            <p className="text-sm text-gray-600">
              Mock data by default. Upload a FHIR Bundle (.json) or HL7 v2
              message (.hl7 / .h7 / .txt) and see how data normalization drives
              care gaps.
            </p>
            {usingUploaded && (
              <p className="text-xs text-green-700 mt-1">
                Using uploaded FHIR bundle for{" "}
                <strong>{getPatientDisplayName(uploadedPatient)}</strong>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 items-start md:items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">
                Patient
              </label>
              <select
                className="border rounded px-3 py-1 text-sm"
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
              >
                {patientOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {getPatientDisplayName(p)}
                    {uploadedPatient && p.id === uploadedPatient.id
                      ? " (uploaded)"
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 text-xs">
              <label className="font-medium">
                Upload FHIR Bundle (.json) or HL7 v2 (.hl7 / .h7 / .txt)
              </label>
              <input
                type="file"
                accept=".json,.hl7,.h7,.txt"
                onChange={handleUniversalUpload}
              />
            </div>
          </div>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-4">
            <Card title="Patient Summary">
              <div className="text-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium">
                    {getPatientDisplayName(activePatient)}
                  </span>
                  <Badge>{activePatient.gender}</Badge>
                </div>
                <div>Age: {age}</div>
                <div className="text-xs text-gray-400">
                  FHIR ID: {activePatient.id}
                </div>
              </div>
            </Card>

            <Card title="Active Conditions">
              {activeResources.conditions &&
              activeResources.conditions.length > 0 ? (
                <ul className="text-xs flex flex-col gap-1">
                  {activeResources.conditions.map((c) => (
                    <li key={c.id} className="flex justify-between">
                      <span>
                        {(c.code &&
                          c.code.coding &&
                          c.code.coding[0] &&
                          c.code.coding[0].display) ||
                          "Condition"}
                      </span>
                      <Badge variant="default">
                        {(c.clinicalStatus && c.clinicalStatus.text) || ""}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">
                  No conditions recorded.
                </p>
              )}
            </Card>
          </div>

          <div className="md:col-span-2 flex flex-col gap-4">
            <Card title="Clinical Timeline">
              {timeline.length === 0 ? (
                <p className="text-xs text-gray-500">No events recorded.</p>
              ) : (
                <ol className="relative border-l border-gray-300 pl-4 text-xs">
                  {timeline.map((ev) => (
                    <li key={ev.id} className="mb-4">
                      <div className="absolute -left-1.5 w-3 h-3 bg-white border border-gray-400 rounded-full"></div>
                      <div className="flex justify-between">
                        <span>
                          <Badge>{ev.type}</Badge> {ev.label}
                        </span>
                        <span className="text-gray-500">
                          {formatFHIRDate(ev.date)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card title="Care Gaps">
                {careGaps.length === 0 ? (
                  <p className="text-xs text-green-700">
                    No care gaps identified based on current rules.
                  </p>
                ) : (
                  <ul className="text-xs flex flex-col gap-2">
                    {careGaps.map((g) => (
                      <li
                        key={g.id}
                        className="p-2 border rounded bg-gray-50"
                      >
                        <div className="flex justify-between mb-1">
                          <span className="font-medium">{g.label}</span>
                          <Badge variant={g.severity}>{g.severity}</Badge>
                        </div>
                        {g.lastDate && (
                          <div className="text-[11px] text-gray-500">
                            Last date on record:{" "}
                            {formatFHIRDate(g.lastDate)}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Recommended Actions">
                {careGaps.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    No immediate recommendations.
                  </p>
                ) : (
                  <ul className="text-xs flex flex-col gap-2">
                    {careGaps.map((g) => (
                      <li
                        key={g.id}
                        className="p-2 border rounded bg-white"
                      >
                        <div className="font-medium">
                          {g.recommendation}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Triggered by: {g.label}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <Card title="HL7 → FHIR Ingestion">
              {hl7MappedObservation ? (
                <div className="flex flex-col gap-2 text-xs">
                  {hl7Error && (
                    <p className="text-red-600">{hl7Error}</p>
                  )}
                  <div>
                    <div className="font-semibold mb-1">Raw HL7</div>
                    <pre className="bg-gray-900 text-gray-100 p-2 rounded max-h-40 overflow-auto whitespace-pre-wrap text-[11px]">
                      {hl7Raw}
                    </pre>
                  </div>
                  <div>
                    <div className="font-semibold mb-1">
                      Mapped FHIR Observation
                    </div>
                    <pre className="bg-gray-100 text-gray-800 p-2 rounded max-h-40 overflow-auto text-[11px]">
                      {JSON.stringify(hl7MappedObservation, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  Upload a file. If it is a FHIR Bundle (.json), the app
                  parses the Bundle and adds a new patient. If it is an HL7 v2
                  message (.hl7 / .h7 / .txt with an OBX segment), the app
                  parses the HL7, maps OBX into a FHIR Observation for the
                  selected patient, and immediately updates the timeline and
                  care gaps.
                </p>
              )}
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
