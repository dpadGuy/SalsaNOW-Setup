const GFN_ENDPOINT = "https://games.geforce.com/graphql";
const LANGUAGE = "ro_RO";

// Don't add a country argument: it silently drops some games from the result.
const GAMES_QUERY = `
  query Games($appIds: [String!], $first: Int, $language: String) {
    apps(appIds: $appIds, first: $first, language: $language) {
      items {
        id
        title
        images {
          TV_BANNER
        }
      }
    }
  }
`;

const grid = document.querySelector("#games");
const status = document.querySelector("#status");
const searchInput = document.querySelector("#search");

let approvedGames = [];
let approvedNotice = null;

async function loadConfiguredGames() {
  const response = await fetch("games.json", { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Could not load games.json (HTTP ${response.status})`);
  }
  const { games } = await response.json();
  return games;
}

async function fetchGfnGames(ids) {
  const response = await fetch(GFN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: GAMES_QUERY,
      variables: { appIds: ids, first: ids.length, language: LANGUAGE },
    }),
  });
  if (!response.ok) {
    throw new Error(`GeForce NOW request failed (HTTP ${response.status})`);
  }
  const { data, errors } = await response.json();
  if (errors?.length) {
    throw new Error(errors[0].message);
  }
  return data.apps.items;
}

function normalize(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ®™]/g, "")
    .toLowerCase()
    .trim();
}

function createCard(game) {
  const column = document.createElement("div");
  column.className = "game-grid-item";

  const card = document.createElement("div");
  card.className = "card h-100 game-card";

  const hero = document.createElement("img");
  hero.className = "card-img-top game-hero";
  hero.loading = "lazy";
  hero.alt = "";

  const body = document.createElement("div");
  body.className = "card-body d-flex flex-column gap-2";

  const name = document.createElement("h5");
  name.className = "card-title fs-6 mb-0 text-break";

  if (game) {
    hero.src = game.images.TV_BANNER;
    name.textContent = game.title;

    const setup = document.createElement("button");
    setup.type = "button";
    // mt-auto keeps buttons lined up at the bottom when titles wrap to different heights.
    setup.className = "btn btn-gfn btn-sm text-nowrap d-flex justify-content-center align-items-center gap-1 mt-auto";

    const icon = document.createElement("img");
    icon.className = "btn-icon";
    icon.src = "lime.webp";
    icon.alt = "";

    setup.append("Setup SalsaNOW", icon);
    body.append(name, setup);

    // Clicks on the button bubble up here, and it gives the card keyboard access.
    card.addEventListener("click", () => {
      location.href = `play.html?id=${encodeURIComponent(game.id)}`;
    });
  } else {
    card.classList.add("placeholder-glow");
    hero.classList.add("placeholder");
    const placeholder = document.createElement("span");
    placeholder.className = "placeholder col-7";
    name.append(placeholder);
    body.append(name);
  }

  card.append(hero, body);
  column.append(card);
  return column;
}

function showStatus(message, level) {
  status.className = `alert alert-${level}`;
  status.textContent = message;
  status.hidden = false;
}

function hideStatus() {
  status.hidden = true;
}

function showGames() {
  const query = normalize(searchInput.value);
  const matches = approvedGames.filter((game) => normalize(game.title).includes(query));
  grid.replaceChildren(...matches.map((game) => createCard(game)));

  if (query && !matches.length) {
    showStatus(`No games found for "${searchInput.value.trim()}".`, "secondary");
  } else if (approvedNotice) {
    showStatus(approvedNotice.message, approvedNotice.level);
  } else {
    hideStatus();
  }
}

async function main() {
  // Browsers block fetching games.json from file:// pages.
  if (location.protocol === "file:") {
    showStatus("This page can't run as a local file. Run \"python serve.py\" in this folder, then open http://localhost:5173", "warning");
    return;
  }

  try {
    const allConfigured = await loadConfiguredGames();
    const configured = allConfigured.filter(({ id }) => id);
    const withoutId = allConfigured.filter(({ id }) => !id);
    grid.replaceChildren(...configured.map(() => createCard()));

    const ids = configured.map((game) => game.id);
    const gamesById = new Map((ids.length ? await fetchGfnGames(ids) : []).map((game) => [game.id, game]));

    // Keep the order from games.json; GFN returns its own order.
    const found = configured.filter(({ id }) => gamesById.has(id));
    approvedGames = found.map(({ id }) => gamesById.get(id));

    const notices = [];
    if (withoutId.length) {
      notices.push(`Missing a GeForce NOW ID in games.json: ${withoutId.map(({ name }) => name).join(", ")}.`);
    }
    const missing = configured.filter(({ id }) => !gamesById.has(id));
    if (missing.length) {
      const labels = missing.map(({ id, name }) => name ?? id).join(", ");
      notices.push(`Not found on GeForce NOW: ${labels}.`);
    }
    if (notices.length) {
      approvedNotice = { message: notices.join(" "), level: "warning" };
    }
  } catch (error) {
    console.error(error);
    approvedNotice = { message: `Couldn't load games. ${error.message}`, level: "danger" };
  }

  searchInput.addEventListener("input", showGames);
  showGames();
}

main();
