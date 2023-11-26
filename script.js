'use strict';

class Workout {
  date = new Date();
  clicks = 0;

  constructor(coords, distance, duration) {
    // this.date = ...
    // this.id = ...
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()} ${this.distance}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence, id) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
    this.id = id ? id : (Date.now() + '').slice(-10);
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain, id) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    // this.type = 'cycling';
    this.calcSpeed();
    this._setDescription();
    this.id = id ? id : (Date.now() + '').slice(-10);
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// const run1 = new Running([39, -12], 5.2, 24, 178);
// const cycling1 = new Cycling([39, -12], 27, 95, 523);
// console.log(run1, cycling1);

///////////////////////////////////////
// APPLICATION ARCHITECTURE
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const resetBtn = document.querySelector('.btn__reset');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #markers = [];
  workoutElement;
  workoutID;

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // toggle reset btn
    this._toggleResetbtn();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    resetBtn.addEventListener('click', this.reset);
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get edit data
    let oldworkout;
    let coords;

    if (this.workoutID || this.workoutID == 0) {
      oldworkout = this.#workouts[this.workoutID];

      coords = oldworkout.coords;
    }

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = coords ? coords : this.#mapEvent.latlng;
    let workout;

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;

      // Check if data is valid
      if (
        // !Number.isFinite(distance) ||
        // !Number.isFinite(duration) ||
        // !Number.isFinite(cadence)
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers!');

      workout = oldworkout
        ? new Running(coords, distance, duration, cadence, oldworkout.id)
        : new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers!');

      workout = oldworkout
        ? new Cycling(coords, distance, duration, elevation, oldworkout.id)
        : new Cycling([lat, lng], distance, duration, elevation);
    }

    // when I'm editing a workout
    if (this.workoutID || this.workoutID == 0) {
      // replace workout in #workouts array
      this.#workouts.splice(this.#workouts.indexOf(oldworkout), 1, workout);

      // render workout in list
      this._renderWorkout(workout, this.#workouts.indexOf(oldworkout));

      // edit workout in map
      this._renderWorkoutMarker(workout, true);

      // update local storage
      this._setLocalStorage();

      // modify workoutID
      this.workoutID = null;

      // hide form + clear input fields
      this._hideForm();

      return;
    }

    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();

    // toggle reset btn
    this._toggleResetbtn();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout, edit = false) {
    if (edit) {
      // remove marker from map
      const targetMarker = this.#markers.find(
        marker => marker.workoutId == workout.id
      );

      // remove marker on map
      this.#map.removeLayer(targetMarker);
    }

    // render marker
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    marker.workoutId = workout.id;
    if (edit) {
      const targetMarkerIndex = this.#markers.findIndex(
        marker => marker.workoutId == workout.id
      );

      // replace old marker in #markers array
      this.#markers.splice(targetMarkerIndex, 1, marker);
    } else this.#markers.push(marker);
  }

  _renderWorkout(workout, position = false) {
    const li = document.createElement('li');
    li.className = `workout workout--${workout.type}`;
    li.setAttribute('data-id', workout.id);

    let html = `
      <h2 class="workout__title">${workout.description}</h2>
      <div class="workout__details">
        <span class="workout__icon">${
          workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
        }</span>
        <span class="workout__value">${workout.distance}</span>
        <span class="workout__unit">km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value">${workout.duration}</span>
        <span class="workout__unit">min</span>
      </div>
    `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
        <div class="icons">
          <button class="button__edit">
            <i class="fa-solid fa-pen-to-square icon__edit"></i> 
          </button>
          <button class="button__delete">
            <i class="fa-solid fa-trash icon__delete"></i>
          </button>
        </div>
      `;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
        <div class="icons">
          <button class="button__edit">
            <i class="fa-solid fa-pen-to-square icon__edit"></i> 
          </button>
          <button class="button__delete">
            <i class="fa-solid fa-trash icon__delete"></i>
          </button>
        </div>
      </li>
      `;

    li.innerHTML = html;
    if (position) {
      this.workoutElement.parentNode.replaceChild(li, this.workoutElement);
    } else form.insertAdjacentElement('afterend', li);
  }

  _moveToPopup(e) {
    // BUGFIX: When we click on a workout before the map has loaded, we get an error. But there is an easy fix:
    if (!this.#map) return;

    if (e.target.classList.contains('icon__delete')) {
      this._deleteWorkout(e);
      return;
    }

    if (e.target.classList.contains('icon__edit')) {
      this._editWorkout(e);
      return;
    }

    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // using the public interface
    // workout.click();
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    console.log(data)

    if (!data) return;

    // convert data to running/cycling workout
    data.forEach(obj => {
      this.#workouts.push(
        obj.type === 'running'
          ? new Running(
              obj.coords,
              obj.distance,
              obj.duration,
              obj.cadence,
              obj.id
            )
          : new Cycling(
              obj.coords,
              obj.distance,
              obj.duration,
              obj.elevationGain,
              obj.id
            )
      );
    });

    console.log(this)
    // render each workout
    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }

  _editWorkout(e) {
    this.workoutElement = e.target.closest('.workout');
    const target = this.#workouts.findIndex(
      workout => this.workoutElement.dataset.id === workout.id
    );
    this.workoutID = target;

    this._showForm();
  }

  _deleteWorkout(e) {
    // find the clicked workout element
    const workoutEl = e.target.closest('.workout');

    // find the index of the workout in the workouts array
    const target = this.#workouts.findIndex(
      workout => workoutEl.dataset.id === workout.id
    );

    // Remove from workouts array
    this.#workouts.splice(target, 1);

    // find workout marker in markers
    const targetMarker = this.#markers.find(
      marker => marker.workoutId == workoutEl.dataset.id
    );

    // remove workout marker on the map
    this.#map.removeLayer(targetMarker);

    // update markers
    this.#markers.splice(this.#markers.indexOf(targetMarker), 1);

    // remove workout from list
    workoutEl.remove();

    // hide form
    this._hideForm();

    // reset workoutID and workoutElement
    this.workoutElement = this.workoutID = null;

    // toggle-off resetbtn when workouts array is empty
    this._toggleResetbtn();

    // update workouts array in local storage
    this._setLocalStorage();
  }

  _toggleResetbtn() {
    if (this.#workouts.length) resetBtn.classList.remove('hidden');
    if (!this.#workouts.length) {
      resetBtn.classList.add('hidden');
    }
  }
}

const app = new App();
