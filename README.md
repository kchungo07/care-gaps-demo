Patient Timeline & Care-Gaps Prototype

A interoperability demo showcasing HL7 v2 to FHIR normalization, clinical event timelines, and automated care-gap logic.

Overview

This application ingests mock FHIR-like patient data, uploaded FHIR Bundles, and HL7 v2 messages.
All data is normalized into a unified FHIR-style format, inserted into a patient timeline, and processed by a rules engine that identifies care gaps such as overdue A1c, missing blood pressure readings, overdue annual wellness visits, and preventive screening needs.

It is intentionally simple, front-end only, and easy to run locally.
Its purpose is to demonstrate knowledge of interoperability, data transformation, and clinical logic execution.

Features

Mock patient dataset included for immediate testing and demonstration

Upload a FHIR Bundle (.json)
FHIR resources extracted automatically: Patient, Observation, Encounter, Condition, Immunization

Upload HL7 v2 ORU^R01 messages (.txt)
HL7 segments parsed: MSH, PID, OBR, OBX
Converted into a FHIR-like Observation and inserted into the timeline

Real-Time Care-Gap Engine
Automatically evaluates:
A1c overdue greater than 12 months
Missing A1c for diabetic patients
Blood pressure overdue greater than 6 months
Missing BP for hypertensive patients
Mammogram needed for women ages 50–74
Annual Wellness Visit overdue greater than 12 months

Timeline Normalization
Dates are converted to YYYY-MM-DD
Events appear chronologically even if uploaded out of order

Folder Structure

/src
App.js
index.js
public
README.md
package.json

Running the Application

Clone the repository

git clone https://github.com/kchungo07/care-gaps-prototype.git
cd care-gaps-prototype


Install dependencies

npm install


Start the app

npm start


The application will open at
http://localhost:3000

How to Use the App

Using Mock Data
Select Jane Doe or John Smith from the dropdown to view their timeline and care gaps.

Uploading a FHIR Bundle
Select a Oliva Example- new-fhir.json file that includes FHIR resources.
A new patient will appear in the dropdown and the timeline and care-gaps sections will update.

FHIR Bundle example:

{
  "resourceType": "Bundle",
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "id": "patient-file-1",
        "name": [{ "given": ["Olivia"], "family": "Example" }],
        "gender": "female",
        "birthDate": "1965-04-12"
      }
    }
  ]
}


Uploading an HL7 v2 Message
Upload a .txt or .hl7 HL7 file.
OBX results will be converted into Observations and added to the timeline.

HL7 ORU^R01 example:

MSH|^~\&|LABSYS|HOSPITAL|EHR|HOSPITAL|20250201103000||ORU^R01|123456|P|2.3
PID|1||12345^^^HOSP^MR||Doe^Jane||19650412|F
OBR|1||78901^LAB||HBA1C^Hemoglobin A1c|||20250131100000
OBX|1|NM|4548-4^HBA1C^Hemoglobin A1c||6.7|%|4.0-6.0|H|||F|||20250201101500

Demonstration Scenarios

Closing a care gap with new lab data
Upload a new A1c HL7 message and watch the “A1c overdue” gap disappear.

Timeline correction using backdated data
Upload an older HL7 message and observe how it moves to the correct location in the timeline.

Creating a new patient
Upload a FHIR Bundle to create a new patient entry. Oliva Example- new-fhir.json

Hypertension monitoring gap
Upload HL7 results without BP data to demonstrate BP gap persistence.

Annual Wellness Visit updates
Upload FHIR or HL7 encounter data to close the AWV gap.

Architecture Summary

Data Ingestion: HL7 v2 and FHIR JSON
Normalization: All events converted to FHIR-like resources
Rules Engine: Pure function that evaluates timestamps and conditions
React Front End: Uses hooks, memoization, and clean state management