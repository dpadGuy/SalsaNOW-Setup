const COPIED_LABEL_MS = 2_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const notice = document.querySelector("#notice");
const message = document.querySelector("#message");
const webAppLink = document.querySelector("#web-app");
const installGuide = document.querySelector("#install-guide");
const gamePathButton = document.querySelector("#copy-game-path");
const backButton = document.querySelector("#go-back");
const nextButton = document.querySelector("#next-step");
const closeButton = document.querySelector("#close");
const relaunchButton = document.querySelector("#relaunch");
const stepCounter = document.querySelector("#step-counter");
const gameId = new URLSearchParams(location.search).get("id");

// Steps are the .step sections of play.html, in page order. The finish screen comes last and isn't counted.
const steps = [...document.querySelectorAll(".step")];
const countedSteps = steps.filter((step) => !step.classList.contains("finish-step")).length;
let currentStep = 0;

function showStep(index) {
  currentStep = index;
  steps.forEach((step, i) => {
    step.hidden = i !== index;
    // Hidden steps still take up space (see .play-main in styles.css), so keep their controls out of reach.
    step.inert = i !== index;
    const video = step.querySelector("video");
    if (!video) {
      return;
    }
    // Every step's video starts from the beginning when the step is shown, and stops when it's left.
    video.pause();
    video.currentTime = 0;
    if (i === index) {
      // Videos are muted so browsers allow them to autoplay; if they still refuse, the controls remain.
      video.play().catch(() => {});
    }
  });
  nextButton.disabled = index === steps.length - 1;

  // On the finish screen, Close takes Next step's place and the counter is hidden.
  const isFinish = steps[index].classList.contains("finish-step");
  nextButton.hidden = isFinish;
  closeButton.hidden = !isFinish;
  stepCounter.hidden = isFinish;
  stepCounter.textContent = `Step ${index + 1} of ${countedSteps}`;
}

async function copyText(button, text) {
  const label = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied!";
  } catch (error) {
    console.error(error);
    button.textContent = "Couldn't copy. Try again.";
  }
  setTimeout(() => {
    button.textContent = label;
  }, COPIED_LABEL_MS);
}

async function loadGamePath(id) {
  const response = await fetch("games.json", { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Could not load games.json (HTTP ${response.status})`);
  }
  const { games } = await response.json();
  return games.find((game) => game.id === id)?.path;
}

backButton.addEventListener("click", () => {
  if (currentStep === 0) {
    location.href = ".";
  } else {
    showStep(currentStep - 1);
  }
});

nextButton.addEventListener("click", () => {
  if (currentStep < steps.length - 1) {
    showStep(currentStep + 1);
  }
});

// Pages can only close tabs they opened themselves, so Close returns to the games list.
closeButton.addEventListener("click", () => {
  location.href = ".";
});

document.querySelectorAll(".copy-button[data-copy]").forEach((button) => {
  button.addEventListener("click", () => copyText(button, button.dataset.copy));
});

if (gameId && UUID_PATTERN.test(gameId)) {
  webAppLink.href = `https://play.geforcenow.com/mall/#/deeplink?action=play-game&game-id=${gameId}`;
  webAppLink.addEventListener("click", () => showStep(steps.indexOf(installGuide)));
  showStep(0);

  const launchGame = () => {
    location.href = `geforcenow://route/#/deeplink?action=play-game&game-id=${gameId}`;
  };
  relaunchButton.addEventListener("click", launchGame);

  // Open GeForce NOW every time a game is chosen (a normal navigation here, such as clicking its card),
  // but not when the page is merely reloaded or revisited with Back/Forward.
  const navigationType = performance.getEntriesByType("navigation")[0]?.type ?? "navigate";
  if (navigationType === "navigate") {
    launchGame();
  }

  loadGamePath(gameId)
    .then((path) => {
      if (path) {
        gamePathButton.disabled = false;
        gamePathButton.addEventListener("click", () => copyText(gamePathButton, path));
      } else {
        gamePathButton.textContent = "No game path set for this game yet";
      }
    })
    .catch((error) => {
      console.error(error);
      gamePathButton.textContent = "Couldn't load the game path";
    });
} else {
  notice.hidden = true;
  steps.forEach((step) => {
    step.inert = true;
  });
  message.hidden = false;
  nextButton.hidden = true;
}
