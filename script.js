/* ==========================================
   1. SUPABASE CONNECTION
   ========================================== */

// Enter your actual Supabase Project URL.
// Do NOT add /rest/v1 at the end.

const SUPABASE_URL =
  "https://fjjsmeriudjzkmwrbqdd.supabase.co";

// Enter your Supabase publishable key.
// Never use a secret or service_role key.

const SUPABASE_KEY =
  "sb_publishable_g5YAtmp8uuo5NNWBBn8rDw_t-bYykHw";

const db = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


/* ==========================================
   2. INITIALIZE MAP
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
   3. HTML ELEMENTS
   ========================================== */

const activityFilter =
  document.getElementById("activity-filter");

const emptyCategoryMessage =
  document.getElementById("empty-category-message");

const mapLegend =
  document.getElementById("map-legend");


/* ==========================================
   4. ACTIVITY MARKER LAYERS
   ========================================== */

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
   5. ESCAPE HTML
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
   6. FORMAT DATE
   ========================================== */

function formatVisitDate(dateString) {

  if (!dateString) {
    return "Not recorded";
  }

  const date = new Date(
    dateString + "T00:00:00"
  );

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

}


/* ==========================================
   7. FORMAT TIME
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
   8. SCHOOL VISIT STATUS
   ========================================== */

function getSchoolStatus(latestVisit) {

  if (!latestVisit || !latestVisit.visit_date) {
    return "gray";
  }

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const visitDate = new Date(
    latestVisit.visit_date + "T00:00:00"
  );

  if (Number.isNaN(visitDate.getTime())) {
    return "gray";
  }

  const daysSinceVisit = Math.floor(
    (today - visitDate) /
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
   9. SCHOOL MARKER ICON
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
   10. OTHER ACTIVITY MARKER ICONS
   ========================================== */

const categoryIcons = {

  "home-for-elders": "👴",

  "hunger-relief": "🍲",

  "clothes-collection": "👕",

  "vipassana": "🧘",

  "sanitary-pads": "🩷",

  "miscellaneous": "📍"

};


function createActivityIcon(category) {

  const symbol =
    categoryIcons[category] || "📍";

  return L.divIcon({

    className: "school-marker-container",

    html: `
      <div class="school-marker">

        <div class="school-symbol">
          ${symbol}
        </div>

      </div>
    `,

    iconSize: [44, 44],

    iconAnchor: [22, 22],

    popupAnchor: [0, -22]

  });

}


/* ==========================================
   11. VOLUNTEER NAMES
   ========================================== */

function getSchoolVolunteerNames(visit) {

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


function getEventVolunteerNames(event) {

  if (!event || !event.event_volunteers) {
    return "Not recorded";
  }

  const names = event.event_volunteers
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
   12. SCHOOL POPUP
   ========================================== */

function createSchoolPopup(school, latestVisit) {

  let html = `

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

    html += `

      <p>
        <strong>Principal:</strong>
        ${escapeHTML(school.principal_name)}
      </p>

    `;

  }

  html += "<hr>";

  if (latestVisit) {

    html += `

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
        ${getSchoolVolunteerNames(latestVisit)}
      </p>

      <p>
        <strong>Notes:</strong><br>
        ${escapeHTML(latestVisit.notes || "No notes recorded")}
      </p>

    `;

  } else {

    html += `

      <p>
        No visits recorded yet.
      </p>

    `;

  }

  html += "</div>";

  return html;

}


/* ==========================================
   13. ACTIVITY POPUP
   ========================================== */

function createActivityPopup(location, events) {

  let html = `

    <div class="school-popup">

      <h3>
        ${escapeHTML(location.name)}
      </h3>

  `;

  if (location.address) {

    html += `

      <p>
        <strong>Address:</strong><br>
        ${escapeHTML(location.address)}
      </p>

    `;

  }

  if (location.description) {

    html += `

      <p>
        ${escapeHTML(location.description)}
      </p>

    `;

  }

  html += "<hr>";

  if (!events || events.length === 0) {

    html += `

      <p>
        No events recorded yet.
      </p>

    `;

  } else {

    html += `

      <p>
        <strong>
          Total Events: ${events.length}
        </strong>
      </p>

    `;

    for (const event of events) {

      html += `

        <div class="event-details">

          <p>
            <strong>
              ${escapeHTML(event.title || "InnerEYE Visit")}
            </strong>
          </p>

          <p>
            <strong>Date:</strong>
            ${formatVisitDate(event.event_date)}
          </p>

          <p>
            <strong>Time:</strong>
            ${formatVisitTime(event.event_time)}
          </p>

          <p>
            <strong>Volunteers:</strong><br>
            ${getEventVolunteerNames(event)}
          </p>

          <p>
            <strong>Description:</strong><br>
            ${escapeHTML(event.description || "Not recorded")}
          </p>

        </div>

        <hr>

      `;

    }

  }

  html += "</div>";

  return html;

}


/* ==========================================
   14. LOAD SCHOOLS
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

    return;

  }

  const schoolLayer =
    activityLayers["classroom-teaching"];

  schoolLayer.clearLayers();

  for (const school of schools || []) {

    const latitude = Number(school.latitude);
    const longitude = Number(school.longitude);

    if (
      school.latitude == null ||
      school.longitude == null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      continue;
    }

    const visits = Array.isArray(school.visits)
      ? [...school.visits]
      : [];

    visits.sort((a, b) => {

      const dateA =
        `${a.visit_date || ""}T${a.visit_time || "00:00:00"}`;

      const dateB =
        `${b.visit_date || ""}T${b.visit_time || "00:00:00"}`;

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
   15. LOAD ALL ACTIVITY LOCATIONS
   ========================================== */

async function loadActivityLocations() {

  /*
    Read the activity categories first.

    This avoids assuming that
    Home for Elders always has ID 2.
  */

  const {
    data: categories,
    error: categoryError
  } = await db
    .from("activity_categories")
    .select("id, slug");

  if (categoryError) {

    console.error(
      "Error loading activity categories:",
      categoryError
    );

    return;

  }

  const categoryLookup = {};

  for (const category of categories || []) {

    categoryLookup[category.id] =
      category.slug;

  }

  /*
    Fetch all locations, together with
    their events and participating volunteers.
  */

  const {
    data: locations,
    error: locationError
  } = await db
    .from("locations")
    .select(`
      id,
      name,
      address,
      latitude,
      longitude,
      category_id,
      description,
      events (
        id,
        event_date,
        event_time,
        title,
        description,
        event_volunteers (
          volunteers (
            id,
            name
          )
        )
      )
    `);

  if (locationError) {

    console.error(
      "Error loading activity locations:",
      locationError
    );

    return;

  }

  /*
    Clear existing non-school markers.
  */

  Object.entries(activityLayers).forEach(
    ([category, layer]) => {

      if (category !== "classroom-teaching") {
        layer.clearLayers();
      }

    }
  );

  /*
    Create markers.
  */

  for (const location of locations || []) {

    const category =
      categoryLookup[location.category_id];

    if (!category) {
      continue;
    }

    /*
      Schools currently come from the
      existing schools table.

      Avoid creating duplicate school markers.
    */

    if (category === "classroom-teaching") {
      continue;
    }

    const layer = activityLayers[category];

    if (!layer) {
      continue;
    }

    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);

    if (
      location.latitude == null ||
      location.longitude == null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      continue;
    }

    const events = Array.isArray(location.events)
      ? [...location.events]
      : [];

    /*
      Most recent events first.
    */

    events.sort((a, b) => {

      const dateA =
        `${a.event_date || ""}T${a.event_time || "00:00:00"}`;

      const dateB =
        `${b.event_date || ""}T${b.event_time || "00:00:00"}`;

      return dateB.localeCompare(dateA);

    });

    const marker = L.marker(
      [latitude, longitude],
      {
        icon: createActivityIcon(category)
      }
    );

    marker.bindPopup(
      createActivityPopup(location, events),
      {
        maxWidth: 320,
        maxHeight: 350
      }
    );

    marker.addTo(layer);

  }

  updateActivityFilter();

}


/* ==========================================
   16. ACTIVITY FILTER
   ========================================== */

function updateActivityFilter() {

  const selectedCategory =
    activityFilter.value;

  /*
    Remove all activity layers.
  */

  Object.values(activityLayers).forEach(layer => {

    if (map.hasLayer(layer)) {
      map.removeLayer(layer);
    }

  });

  /*
    Display the selected category.
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
    Empty category message.
  */

  if (visibleMarkerCount === 0) {

    emptyCategoryMessage.textContent =
      "No activities recorded in this category yet.";

    emptyCategoryMessage.classList.remove("hidden");

  } else {

    emptyCategoryMessage.classList.add("hidden");

  }

  /*
    School legend.
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
   17. DROPDOWN EVENT LISTENER
   ========================================== */

activityFilter.addEventListener(
  "change",
  updateActivityFilter
);


/* ==========================================
   18. INITIALIZE WEBSITE
   ========================================== */

async function initializeWebsite() {

  updateActivityFilter();

  await Promise.all([
    loadSchools(),
    loadActivityLocations()
  ]);

}

initializeWebsite();
