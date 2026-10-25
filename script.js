// ==========================================
// 1. SUPABASE CONNECTION
// ==========================================

const SUPABASE_URL =
  "https://fjjsmeriudjzkmwrbqdd.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_g5YAtmp8uuo5NNWBBn8rDw_t-bYykHw";

const db = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


// ==========================================
// 2. TEMPORARY FORM PASSWORD
// ==========================================

// IMPORTANT:
// This is only a temporary convenience lock.
// Anyone inspecting the JavaScript can potentially
// see this password.

const FORM_PASSWORD = "InnerEye123";


// ==========================================
// 3. CREATE THE MAP
// ==========================================

const map = L.map("map").setView(
  [12.9716, 77.5946],
  11
);

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    attribution: "&copy; OpenStreetMap contributors"
  }
).addTo(map);


// ==========================================
// 4. CALCULATE SCHOOL STATUS
// ==========================================

function getSchoolStatus(latestVisit) {

  // No visit recorded
  if (!latestVisit) {
    return "gray";
  }

  const visitDate = new Date(
    latestVisit.visit_date + "T00:00:00"
  );

  const today = new Date();

  // Compare calendar dates
  today.setHours(0, 0, 0, 0);

  const difference =
    today.getTime() - visitDate.getTime();

  const daysSinceVisit =
    difference / (1000 * 60 * 60 * 24);


  // Within 30 days
  if (daysSinceVisit <= 30) {
    return "green";
  }


  // 31–60 days
  if (daysSinceVisit <= 60) {
    return "yellow";
  }


  // More than 60 days
  return "red";
}


// ==========================================
// 5. CREATE SCHOOL ICON
// ==========================================

function createSchoolIcon(status) {

  return L.divIcon({

    className: "school-marker-container",

    html: `
      <div class="school-marker">

        <div class="school-symbol">
          🏫
        </div>

        <div class="status-dot ${status}">
        </div>

      </div>
    `,

    iconSize: [44, 44],

    iconAnchor: [22, 22],

    popupAnchor: [0, -22]

  });
}


// ==========================================
// 6. LOAD SCHOOLS FROM SUPABASE
// ==========================================

async function loadSchools() {

  const { data: schools, error } = await db
    .from("schools")
    .select(`
      id,
      name,
      address,
      latitude,
      longitude,
      principal_name,

      visits (
        id,
        visit_date,
        visit_time,
        notes,

        visit_volunteers (
          volunteers (
            id,
            name
          )
        )
      )
    `);


  if (error) {

    console.error(
      "Supabase error:",
      error
    );

    return;
  }


  console.log(
    "School data:",
    schools
  );


  // ========================================
  // 7. CREATE SCHOOL MARKERS
  // ========================================

  schools.forEach((school) => {

    if (
      school.latitude == null ||
      school.longitude == null
    ) {
      return;
    }


    // --------------------------------------
    // FIND LATEST VISIT
    // --------------------------------------

    let latestVisit = null;


    if (
      school.visits &&
      school.visits.length > 0
    ) {

      school.visits.sort(
        (a, b) => {

          const dateA = new Date(
            `${a.visit_date}T${a.visit_time || "00:00:00"}`
          );

          const dateB = new Date(
            `${b.visit_date}T${b.visit_time || "00:00:00"}`
          );

          return dateB - dateA;

        }
      );


      latestVisit =
        school.visits[0];
    }


    // --------------------------------------
    // SCHOOL STATUS
    // --------------------------------------

    const status =
      getSchoolStatus(latestVisit);


    // --------------------------------------
    // VOLUNTEER NAMES
    // --------------------------------------

    let volunteerNames =
      "Not recorded";


    if (latestVisit) {

      volunteerNames =
        latestVisit
          .visit_volunteers
          ?.map(
            item =>
              item.volunteers?.name
          )
          .filter(Boolean)
          .join(", ")
          || "Not recorded";

    }


    // --------------------------------------
    // BUILD POPUP
    // --------------------------------------

    let popupContent = `

      <div class="school-popup">

        <h3>
          ${school.name}
        </h3>

        <b>Address:</b><br>

        ${school.address || "Not available"}

        <br><br>

    `;


    // --------------------------------------
    // IF SCHOOL HAS BEEN VISITED
    // --------------------------------------

    if (latestVisit) {

      popupContent += `

        <hr>

        <b>Last Visit</b>

        <br><br>

        📅 <b>Date:</b>
        ${latestVisit.visit_date}

        <br>

        🕐 <b>Time:</b>
        ${latestVisit.visit_time || "Not recorded"}

        <br>

        👥 <b>Volunteer(s):</b>
        ${volunteerNames}

        <br><br>

        📝 <b>Notes:</b><br>

        ${latestVisit.notes || "No notes"}

      `;

    }


    // --------------------------------------
    // NEVER VISITED
    // --------------------------------------

    else {

      popupContent += `

        <hr>

        <b>Last Visit:</b>
        Never visited

      `;

    }


    popupContent += `
      </div>
    `;


    // --------------------------------------
    // ADD SCHOOL MARKER
    // --------------------------------------

    const marker = L.marker(

      [
        school.latitude,
        school.longitude
      ],

      {
        icon:
          createSchoolIcon(status)
      }

    ).addTo(map);


    // --------------------------------------
    // ADD POPUP
    // --------------------------------------

    marker.bindPopup(

      popupContent,

      {
        maxWidth: 300
      }

    );

  });

}


// ==========================================
// 8. ADD VISIT FORM
// ==========================================

const openVisitButton =
  document.getElementById(
    "open-visit-form"
  );

const visitPanel =
  document.getElementById(
    "visit-panel"
  );

const closeVisitButton =
  document.getElementById(
    "close-visit-form"
  );

const cancelVisitButton =
  document.getElementById(
    "cancel-visit"
  );

const visitForm =
  document.getElementById(
    "visit-form"
  );


// ==========================================
// 9. OPEN FORM WITH PASSWORD
// ==========================================

function openVisitForm() {

  const enteredPassword = prompt(
    "Enter password to add a school visit:"
  );


  // User clicked Cancel
  if (enteredPassword === null) {
    return;
  }


  // Correct password
  if (
    enteredPassword === FORM_PASSWORD
  ) {

    visitPanel
      .classList
      .remove("hidden");

    openVisitButton
      .style
      .display = "none";

  }


  // Incorrect password
  else {

    alert(
      "Incorrect password."
    );

  }

}


// ==========================================
// 10. CLOSE FORM
// ==========================================

function closeVisitForm() {

  visitPanel
    .classList
    .add("hidden");

  openVisitButton
    .style
    .display = "block";

}


// ==========================================
// 11. FORM BUTTON EVENTS
// ==========================================

openVisitButton.addEventListener(
  "click",
  openVisitForm
);


closeVisitButton.addEventListener(
  "click",
  closeVisitForm
);


cancelVisitButton.addEventListener(
  "click",
  closeVisitForm
);


// ==========================================
// 12. FORM SUBMISSION
// ==========================================

// For now, prevent actual submission.
// We will connect this to Supabase next.

visitForm.addEventListener(
  "submit",
  function(event) {

    event.preventDefault();

    console.log(
      "Form submission will be connected to Supabase next."
    );

  }
);


// ==========================================
// 13. START APPLICATION
// ==========================================

loadSchools();
