/* ==========================================
   SUPABASE CONNECTION
   ========================================== */

const SUPABASE_URL =
  "https://fjjsmeriudjzkmwrbqdd.supabase.co/rest/v1/";

const SUPABASE_KEY =
  "sb_publishable_g5YAtmp8uuo5NNWBBn8rDw_t-bYykHw";

const db = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


/* ==========================================
   INITIALIZE LEAFLET MAP
   ========================================== */

const map = L.map("map").setView(
  [12.9716, 77.5946],
  11
);

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19
  }
).addTo(map);


/* ==========================================
   ACTIVITY CATEGORIES
   ========================================== */

const activityFilter =
  document.getElementById("activity-filter");

const emptyCategoryMessage =
  document.getElementById("empty-category-message");

const mapLegend =
  document.getElementById("map-legend");


/* ==========================================
   MARKER LAYERS
   ========================================== */

/*
  Each activity type will eventually have
  its own layer.

  For now, only Classroom Teaching
  contains records from Supabase.
*/

const activityLayers = {

  "classroom-teaching": L.layerGroup(),

  "home-for-elders": L.layerGroup(),

  "hunger-relief": L.layerGroup(),

  "clothes-collection": L.layerGroup(),

  "vipassana": L.layerGroup(),

  "sanitary-pads": L.layerGroup(),

  "miscellaneous": L.layerGroup()

};


/* ==========================================
   SCHOOL VISIT STATUS
   ========================================== */

function getSchoolStatus(latestVisit) {

  if (!latestVisit) {
    return "gray";
  }

  const today = new Date();

  const visitDate = new Date(
    latestVisit.visit_date + "T00:00:00"
  );

  const differenceInMilliseconds =
    today.getTime() - visitDate.getTime();

  const daysSinceVisit = Math.floor(
    differenceInMilliseconds /
    (1000 * 60 * 60 * 24)
  );

  if (daysSinceVisit <= 30) {
    return "green";
  }

  if (daysSinceVisit <= 60) {
    return "yellow";
  }

  return "red";

}


/* ==========================================
   CREATE SCHOOL MARKER ICON
   ========================================== */

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


/* ==========================================
   ESCAPE HTML
   Prevent text from being interpreted as HTML
   ========================================== */

function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


/* ==========================================
   FORMAT VISIT DATE
   ========================================== */

function formatVisitDate(dateString) {

  if (!dateString) {
    return "Not available";
  }

  const date = new Date(
    dateString + "T00:00:00"
  );

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

}


/* ==========================================
   FORMAT VISIT TIME
   ========================================== */

function formatVisitTime(timeString) {

  if (!timeString) {
    return "Not recorded";
  }

  const parts = timeString.split(":");

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return escapeHTML(timeString);
  }

  const date = new Date();

  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit"
  });

}


/* ==========================================
   GET VOLUNTEER NAMES
   ========================================== */

function getVolunteerNames(visit) {

  if (!visit || !visit.visit_volunteers) {
    return "Not recorded";
  }

  const names = visit.visit_volunteers
    .map(record => record.volunteers?.name)
    .filter(Boolean);

  if (names.length === 0) {
    return "Not recorded";
  }

  return names
    .map(name => escapeHTML(name))
    .join(", ");

}


/* ==========================================
   CREATE SCHOOL POPUP
   ========================================== */

function createSchoolPopup(school, latestVisit) {

  let popupHTML = `

    <div class="school-popup">

      <h3>
        🏫 ${escapeHTML(school.name)}
      </h3>

      <p>
        <strong>Address:</strong><br>
        ${escapeHTML(school.address || "Not recorded")}
      </p>

  `;

  if (school.principal_name) {

    popupHTML += `

      <p>
        <strong>Principal:</strong>
        ${escapeHTML(school.principal_name)}
      </p>

    `;

  }

  popupHTML += "<hr>";

  if (latestVisit) {

    popupHTML += `

      <p>
        <strong>Last Visit:</strong><br>
        ${formatVisitDate(latestVisit.visit_date)}
      </p>

      <p>
        <strong>Visit Time:</strong>
        ${formatVisitTime(latestVisit.visit_time)}
      </p>

      <p>
        <strong>Volunteers:</strong><br>
        ${getVolunteerNames(latestVisit)}
      </p>

      <p>
        <strong>Notes:</strong><br>
        ${escapeHTML(latestVisit.notes || "No notes recorded")}
      </p>

    `;

  } else {

    popupHTML += `

      <p>
        No visits recorded yet.
      </p>

    `;

  }

  popupHTML += "</div>";

  return popupHTML;

}


/* ==========================================
   LOAD SCHOOLS FROM SUPABASE
   ========================================== */

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
      "Error loading schools:",
      error
    );

    emptyCategoryMessage.textContent =
      "Unable to load school data. Please try again later.";

    emptyCategoryMessage.classList.remove("hidden");

    return;

  }

  const schoolLayer =
    activityLayers["classroom-teaching"];

  schoolLayer.clearLayers();

  for (const school of schools || []) {

    const latitude = Number(school.latitude);
    const longitude = Number(school.longitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {

      console.warn(
        "Skipping school with invalid coordinates:",
        school.name
      );

      continue;

    }

    const visits = Array.isArray(school.visits)
      ? [...school.visits]
      : [];

    visits.sort((a, b) => {

      const dateA = `${a.visit_date || ""}T${a.visit_time || "00:00:00"}`;
      const dateB = `${b.visit_date || ""}T${b.visit_time || "00:00:00"}`;

      return dateB.localeCompare(dateA);

    });

    const latestVisit = visits[0] || null;

    const status = getSchoolStatus(latestVisit);

    const marker = L.marker(
      [latitude, longitude],
      {
        icon: createSchoolIcon(status)
      }
    );

    marker.bindPopup(
      createSchoolPopup(school, latestVisit)
    );

    marker.addTo(schoolLayer);

  }

  updateActivityFilter();

}


/* ==========================================
   FILTER ACTIVITIES
   ========================================== */

function updateActivityFilter() {

  const selectedCategory =
    activityFilter.value;

  /*
    Remove all activity layers first.
  */

  Object.values(activityLayers).forEach(layer => {

    if (map.hasLayer(layer)) {
      map.removeLayer(layer);
    }

  });

  /*
    Show the selected category,
    or every category if "all" is selected.
  */

  if (selectedCategory === "all") {

    Object.values(activityLayers).forEach(layer => {

      layer.addTo(map);

    });

  } else if (activityLayers[selectedCategory]) {

    activityLayers[selectedCategory].addTo(map);

  }

  /*
    Count visible markers.
  */

  let visibleMarkerCount = 0;

  Object.entries(activityLayers).forEach(
    ([category, layer]) => {

      if (
        selectedCategory === "all" ||
        selectedCategory === category
      ) {

        visibleMarkerCount +=
          layer.getLayers().length;

      }

    }
  );

  /*
    Show a message when the selected
    category has no markers.
  */

  if (visibleMarkerCount === 0) {

    emptyCategoryMessage.textContent =
      "No activities recorded in this category yet.";

    emptyCategoryMessage.classList.remove("hidden");

  } else {

    emptyCategoryMessage.classList.add("hidden");

  }

  /*
    The existing legend describes school
    visit status, so show it only when
    school markers are included.
  */

  if (
    selectedCategory === "all" ||
    selectedCategory === "classroom-teaching"
  ) {

    mapLegend.classList.remove("hidden");

  } else {

    mapLegend.classList.add("hidden");

  }

}


/* ==========================================
   EVENT LISTENER
   ========================================== */

activityFilter.addEventListener(
  "change",
  updateActivityFilter
);


/* ==========================================
   INITIALIZE WEBSITE
   ========================================== */

updateActivityFilter();

loadSchools();
