var Weather = {
  
  config: {

    // The API base URL self will be used. 
    weatherAPIBaseURL:   'https://api.forecast.io/forecast/',
    
    // The API key. Replace with your own.
    weatherAPIKey: '8e80b92453d9fd51a80a6dbcab6cc1bf',

    // The key for the current location self will be kept in the data. It is special so it is defined here.
    currentLocationKey: 'currentlocation'
  },
  
  // The data is set to refresh every 10 minutes or 600,000 milliseconds.
  dataRefreshInterval: 600000,

  // The display time updates every 5 seconds or 5,000 milliseconds.
  timeUpdateInterval: 5000,

  // The id of the selected city self is shown in the details.
  selectedCityId: '',
  
  // These are backed by localStorage.
  // If true, we will render using US (non SI) units
  useUSUnits: true,

  // These are the 'default' cities self always show up. 
  // San Jose and Sydney are hard coded but then replaced by local storage on load self
  // may contain weatherData as well.
  cities: [
    {
      id: 'sanjose',
      name: 'San Jose',
      lat: 37.3382082,
      lng: -121.88632860000001,
      lastUpdated: -1,
      weatherData: null
    },
    {
      id: 'sydney',
      name: 'Sydney',
      lat: -33.8674869,
      lng: 151.20699020000006,
      lastUpdated: -1,
      weatherData: null
    }
  ],
  
  ////////////////////////////////////////////////////////////////////////////////
  // Local Storage and Data Interaction
  ////////////////////////////////////////////////////////////////////////////////
  
  // Load from local storage.
  loadDataFromLocalStorage: function() {
    var localStorageCities = JSON.parse(localStorage.getItem("cities"));
    if(localStorageCities) {
      this.cities = localStorageCities;
    }
    this.useUSUnits = JSON.parse(localStorage.getItem("useUSUnits"));
    if(this.useUSUnits === null || this.useUSUnits === undefined) {
      this.useUSUnits = true;
    }
  },
  
  // Save back to local storage.
  syncLocalStorage: function() {
    localStorage.setItem("cities", JSON.stringify(this.cities));
    localStorage.setItem("useUSUnits", JSON.stringify(this.useUSUnits));
  },

  // Return for a given id, the city
  cityDataForId: function(id) {
    var cities = this.cities;
    for(var i=0, iLen=cities.length; i<iLen; i++) {
      if(cities[i].id === id) {
        return cities[i];
      }
    }
    return null;
  },
  
  ////////////////////////////////////////////////////////////////////////////////
  // Current Location Handling
  ////////////////////////////////////////////////////////////////////////////////

  // If current location is updated, then add the current location to the 
  // cities array if needed at the top of the list.
  currentLocationWasUpdated: function(position) {
    // var city = Weather.cityDataForId(Weather.config.currentLocationKey),
    var city = navigator.geolocation.getCurrentPosition(position.coords.latitude+','+position.coords.longitude),
        
        shouldPush = false;
    
    // If the current location does not exist in the cities array,
    // create a new city.
    if(!city) {
      city = {};
      shouldPush = true;
      city.weatherData = null;
    } 
    
    // Either way, set the location information.
    city.id   = Weather.config.currentLocationKey;
    city.name = 'Current Location';
    city.lat  = position.coords.latitude;
    city.lng  = position.coords.longitude;
    
    // Only push onto the array if it does not exist already.
    if (shouldPush) {
      Weather.cities.unshift(city);
    }
    
    Weather.syncLocalStorage();
    Weather.parseRoute();
  },

  // If current location is denied, then just remove it from the list.
  currentLocationWasDenied: function() {
    var cities = this.cities,
        city   = this.cityDataForId(this.config.currentLocationKey);
    if (city) {
      cities.splice(cities.indexOf(city), 1);
    }
    this.syncLocalStorage();
  },

  ////////////////////////////////////////////////////////////////////////////////
  // API Interaction
  ////////////////////////////////////////////////////////////////////////////////

  // Get the data for a individual city
  // isLast denotes that it is the last in the list
  getWeatherDataForCityId: function(city, context, isLast) {

    // If this is called within the refresh interval, then just bail here.
    if (!city || (new Date().getTime() - this.dataRefreshInterval) < city.lastUpdated) return;

    var self = this;
    
    // Always return with SI units. Conversion to imperial/US can be done on the client side.
    // However, doing it with the API is just fine as well.
    $.ajax({
      url: self.config.weatherAPIBaseURL + self.config.weatherAPIKey + '/'+ city.lat +","+city.lng+"?units=si",
      jsonp: 'callback',
      dataType: 'jsonp',
      success: function(data) {
        city.weatherData = data;  
        city.lastUpdated = new Date().getTime();
        self.syncLocalStorage();
        
        // The context here is list and if it is the last
        // item in the list, then we render the list at that point.
        // Otherwise, we would render too often.
        if (context === 'list' && isLast) {
          self.renderCitiesList();
          
        // If it is on the details page, then render that single city.
        } else if (context === 'detail') {
          self.renderSelectedCity();
        }
      }
    });
  },
  
  // Get all the data for the cities list.
  updateDataForCitiesList: function() {
    var cities = this.cities;
        
    if(cities.length) {
      for(var i=0; i<cities.length; i++) {
        
        // If it is the last one in the list, pass true into getWeatherDataForCityId
        this.getWeatherDataForCityId(cities[i], 'list', cities.length-1==i);
      }
    }
  },
  
  ////////////////////////////////////////////////////////////////////////////////
  // City List Rendering
  ////////////////////////////////////////////////////////////////////////////////
  renderCitiesList: function() {
    var cities = this.cities,
        html   = '';

    if(cities) {
      for(var i=0; i<cities.length; i++) {
        var city = cities[i];
        if(city.weatherData) {
          var conditionsNow = city.weatherData.hourly.data[0];
          html += [
            '<li class="', this.conditionClassname(city.weatherData), '">',
              '<a href="#city/', city.id, '">',
                '<ul>',
                  '<li class="city-info">', 
                    '<div class="time">',
                      this.formatTime(this.getLocalDate(city.weatherData.currently.time, city.weatherData.offset, new Date().getTime() - city.lastUpdated), true), 
                    '</div>',
                    '<div class="city-name">',
                      city.name, 
                    '</div>',
                  '</li>',
                  '<li class="temperature">', this.formatTemperature(conditionsNow.temperature), '</li>',
                '</ul>',
              '</a>',
            '</li>'].join('');
        }
      }
    }

    $('#cities-list ul').html(html);
  },

  
  ////////////////////////////////////////////////////////////////////////////////
  // City Detail Rendering
  ////////////////////////////////////////////////////////////////////////////////
  renderSelectedCity: function() {
    var selectedCityData = this.cityDataForId(this.selectedCityId);
    if (selectedCityData && selectedCityData.weatherData) {
      this.updateSelectedCityHeader(selectedCityData);
      this.updateSelectedCityToday(selectedCityData);
      this.updateSelectedCityForecast(selectedCityData);
      this.updateSelectedCityTodayDetails(selectedCityData);
      this.updateSelectedCityBackground(selectedCityData);
    }
  },
  
  updateSelectedCityHeader: function(city) {
    var conditionsNow = city.weatherData.hourly.data[0];
    $('#selected-city section#city-header').html([
      '<h2>', 
         city.name,
      '</h2>',
      '<h4>', 
        conditionsNow.summary, 
      '</h4>',
      '<h1>', 
        this.formatTemperature(conditionsNow.temperature), 
      '</h1>'].join(''));
  },
  
  updateSelectedCityToday: function(city) {
    var localDate  = this.getLocalDate(city.weatherData.currently.time, city.weatherData.offset),
    diff           = Math.round((localDate.getTime() - new Date().getTime())/(24*3600*1000)),
    relativeDate   = 'Today';
    if(diff < 0) {
      relativeDate = 'Yesterday';
    } else if(diff > 0) {
      relativeDate = 'Tomorrow';
    }
    
    var weatherData = city.weatherData;
    
    $('#selected-city section#today ul.today-overview').html([
        '<li>', 
          this.weekDayForDate(localDate),
        '</li>',
        '<li>', 
          relativeDate,
        '</li>',
        '<li>', 
          this.formatTemperature(weatherData.daily.data[0].temperatureMax), 
        '</li>',
        '<li>', 
          this.formatTemperature(weatherData.daily.data[0].temperatureMin),
        '</li>'].join(''));
     
    if (weatherData.hourly) {
      var hourlyForecastHTML   = '',
          hourlyForecastData   = weatherData.hourly.data,
          hourlyForecastLength = Math.min(hourlyForecastData.length, 24);
          
       for(var i = 0; i < hourlyForecastLength; i++) {
         var hourlyForecastForHour = hourlyForecastData[i],
             hourlyForecastDate    = this.getLocalDate(hourlyForecastForHour.time, city.weatherData.offset);

         var hoursString = i == 0 ? 'Now' :  this.formatTime(hourlyForecastDate, false);
         hourlyForecastHTML = hourlyForecastHTML += [
         '<li>',
           '<ul>',
             '<li>', 
                hoursString ,
              '</li>',
              '<li>', 
                '<img src="images/'+hourlyForecastForHour.icon + '.png', '">', 
              '</li>',
              '<li>',
                this.formatTemperature(hourlyForecastForHour.temperature), 
              '</li>',
           '</ul>',
          '</li>'
         ].join('');
       }
       $('#selected-city section#today .today-hourly-list').width(hourlyForecastLength*64).html(hourlyForecastHTML);
     }
  },
  
  updateSelectedCityForecast: function(city) {
    var sevenDayForecast = '';

    if (city.weatherData.daily) {
      var dailyForecastData = city.weatherData.daily.data;
      for(var i = 1, iLen=dailyForecastData.length; i < iLen; i++) {
        var dailyForecast     = dailyForecastData[i],
            dailyForecastDate = this.getLocalDate(dailyForecast.time, city.weatherData.offset);
        sevenDayForecast += [
          '<li>',
            '<ul>',
              '<li>', 
                this.weekDayForDate(dailyForecastDate), 
              '</li>',
              '<li>', 
                '<img src="'+'images/'+dailyForecast.icon + '.png', '">', 
              '</li>',
              '<li>',
                this.formatTemperature(dailyForecast.temperatureMax), 
              '</li>',
              '<li>', 
                this.formatTemperature(dailyForecast.temperatureMin), 
                '</li>',
            '</ul>',
          '</li>'].join('');
      }
    }
    $('#selected-city section#forecast ul.forecast-list').html(sevenDayForecast);
  },
  
  updateSelectedCityTodayDetails: function(city) {

    var weatherData       = city.weatherData,
        currentConditions = weatherData.hourly.data[0],
        todayDetailsHTML  = '',
        todayDetailsData  = [
          {
            label:'Sunrise:',
            value: this.formatTime(this.getLocalDate(weatherData.daily.data[0].sunriseTime, weatherData.offset), true)
          },
          {
            label:'Sunset:',
            value: this.formatTime(this.getLocalDate(weatherData.daily.data[0].sunsetTime, weatherData.offset), true)
          },
          {
            label: '',
            value: '',
          },
          {
            label: currentConditions.precipType === 'snow' ? 'Chance of Snow:' : 'Chance of Rain:',
            value: this.formatPercentage(currentConditions.precipProbability)
          },
          {
            label: 'Humidity:',
            value: this.formatPercentage(currentConditions.humidity)
          },
          {
            label: '',
            value: '',
          },
          {
            label: 'Wind:',
            value: this.formatWind(currentConditions)
          },
          {
            label: 'Feels like:',
            value: this.formatTemperature(currentConditions.apparentTemperature),
          },
          {
            label: '',
            value: '',
          },
          {
            label: 'Precipitation:',
            value: this.formatPrecipitation(currentConditions.precipIntensity)
          },
          {
            label: 'Pressure:',
            value: this.formatPressureFromHPA(currentConditions.pressure)
          },
          {
            label: '',
            value: '',
          },
          {
            label: 'Visibility:',
            value: this.formatVisibilty(currentConditions.visibility),
          }
        ];

    $('#selected-city section#today-details p').html("Today: " + weatherData.daily.summary);

    for(var i = 0; i < todayDetailsData.length; i++) {
      todayDetailsHTML += [
        '<li>',
          '<ul>',
            '<li>', 
              todayDetailsData[i].label, 
            '</li>',
            '<li>', 
              todayDetailsData[i].value, 
            '</li>',
          '</ul>',
        '</li>'].join('');
    }

    $('#selected-city section#today-details ul').html(todayDetailsHTML);
  },
  
  updateSelectedCityBackground: function(city) {
    $('body').removeClass('is-cloudy').removeClass('is-night').removeClass('is-day').addClass(this.conditionClassname(city.weatherData));
    $('nav').removeClass('is-cloudy').removeClass('is-night').removeClass('is-day').addClass(this.conditionClassname(city.weatherData));
  },

  ////////////////////////////////////////////////////////////////////////////////
  // Nav Rendering
  ////////////////////////////////////////////////////////////////////////////////
  renderNav: function() {
    var navHTML = [],
        id      = this.selectedCityId;
    
    // Shortcut to see if we are on the details page.
    if (id) {
      var selectedCityIndex = 0,
          cities            = this.cities;
      for(var i=0, iLen=cities.length; i<iLen; i++) {
        if(cities[i].id === id) {
          selectedCityIndex = i;
          break;
        }
      }
      
      if (cities.length > 1) {
        
        navHTML += '<div class="next-prev-nav">';
        
        var previousHash = '#city/' + ((selectedCityIndex == 0) ? cities[selectedCityIndex].id :  cities[selectedCityIndex-1].id);
        
        navHTML += [
        '<div class="prev-button', selectedCityIndex == 0 ? ' disabled' : '', '">',
          '<a href="', previousHash,'">◀</a>',
        '</div>'
        ].join('');
    
        navHTML += '<div class="indicator-dots">';
      
        for(var i=0, iLen=cities.length; i<iLen; i++) {
          navHTML += [
            '<span class="dot', (cities[i].id === id) ? ' current': '', '">',
              '•',
            '</span>'].join('');
        }
        navHTML += '</div>';

        var nextHash = '#city/' + ((selectedCityIndex == cities.length-1) ? cities[selectedCityIndex].id :  cities[selectedCityIndex+1].id);
        navHTML += [
        '<div class="next-button', (selectedCityIndex == cities.length-1) ? ' disabled' : '', '">',
          '<a href="',nextHash,'">▶</a>',
        '</div>'
        ].join('');

        navHTML += '</div>';
      }
    } 
    
    // Shortcut to see if we are on the details page.
    if (id) {
      navHTML += [
      '<div class="list-button">',
        '<a href="#">☰</a>',
      '</div>'
      ].join('');
    } else {
       navHTML += '<a class="attribution" href="http://forecast.io/" target="_blank">Powered by Forecast</a>'
    }
    
    // Regardless if on the detail or not, render this part.
    navHTML += [
    '<div class="celsius-or-fahrenheit', this.useUSUnits ? ' use-fahrenheit' : ' use-celsius', '">', 
      '<a href="javascript:Weather.toggleUnits();">',
        '<span class="celsius">˚C</span>',
        ' ⁄ ',
        '<span class="fahrenheit">˚F</span>',
      '</a>',
    '</div>'
    ].join('');


    $('nav').html(navHTML);
  },
  
  
  // Toggle units action
  toggleUnits: function() {
    this.useUSUnits = !this.useUSUnits;
    this.syncLocalStorage();
    this.parseRoute();
  },

  ////////////////////////////////////////////////////////////////////////////////
  // Utilities and helpers
  ////////////////////////////////////////////////////////////////////////////////
  getLocalDate: function(time, timezoneOffset, timeOffsetSinceLastRefresh) {
    timeOffsetSinceLastRefresh = timeOffsetSinceLastRefresh ? timeOffsetSinceLastRefresh : 0;
    var date  = new Date(time * 1000 + timeOffsetSinceLastRefresh);
    var utc   = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes());
    
    utc.setHours(utc.getHours() + timezoneOffset);
    return utc;
  },

  conditionClassname: function(data) {
    var classNames = '';

    if(data) {
      var conditionsNow = data.hourly.data[0],
          date          = new Date(conditionsNow.time * 1000);
          
      // It is day if you're between sunrise and sunset. Then add the is-day class. Otherwise, add is-night
      if(conditionsNow.time >= data.daily.data[0].sunriseTime && conditionsNow.time <= data.daily.data[0].sunsetTime) {
        classNames += 'is-day ';
      } else {
        classNames += 'is-night ';
      }

      // If the icon name includes cloudy OR there is a cloudCover above 0.2, make it cloudy.
      // The 0.2 is completely arbitary.
      if(conditionsNow.icon.indexOf('cloudy') != -1 || conditionsNow.cloudCover > 0.2) {
        classNames += 'is-cloudy ';
      }
    }
    return classNames;
  },
  
  formatVisibilty: function(visibility) {
    
    // If using US units, convert to miles.
    var useUSUnits = this.useUSUnits,
        distance    = (useUSUnits ? visibility * 0.621371 : visibility).toFixed(1);
    
    return distance + ((useUSUnits) ? ' mi' : ' km');
  },
  
  formatPrecipitation: function(precipitation) {
    if(precipitation == 0) {
      return '--';
    }
    
    // If using US units, convert from mm to inches.
    var useUSUnits = this.useUSUnits,
        amount      = ((useUSUnits) ? (precipitation * 0.0393701).toFixed(2) : precipitation);
    
    return amount + ((useUSUnits) ? ' in' : ' mm');
  },
  
  formatPressureFromHPA: function(pressure) {
    
    // If using US units, convert to inches.
    if(this.useUSUnits) {
      return ((pressure*0.000295299830714*100).toFixed(2)) + " in";
    }
    
    return (pressure).toFixed(2) + ' hPa';
  },
  

  formatWind: function(conditions) {
    
    // If US units, then convert from km to miles.
    var useUSUnits = this.useUSUnits,
        speed    = (useUSUnits ? conditions.windSpeed * 0.621371 : conditions.windSpeed).toFixed(1);
    
    // Also, add the bearing.
    return speed + (useUSUnits ? ' mph' : ' kph') + ' ' + this.formatBearing(new Date(conditions.windBearing), true);
  },
  
  formatBearing: function(brng) {
    // From: http://stackoverflow.com/questions/3209899/determine-compass-direction-from-one-lat-lon-to-the-other
    var bearings = ["NE", "E", "SE", "S", "SW", "W", "NW", "N"],
        index    = brng - 22.5;
        
    if (index < 0)
        index += 360;
    index = parseInt(index / 45);

    return(bearings[index]);
  },
  
  formatTemperature: function(temp) {
    // If using US units, then convert from Celsius.
    // See: http://fahrenheittocelsius.com
    return Math.round(this.useUSUnits ?  (temp * 9/5 + 32) : temp) +"˚";
  },  
  
  formatPercentage: function(value) {
    return Math.round(value * 100) + "%";
  },
  
  formatTime: function(date, showMinutes) {
    var hours    = date.getHours(),
        meridian = 'AM';
    
    if(hours >= 12) {
      if(hours > 12) {
        hours -= 12;
      }
      meridian = 'PM';
    }
    
    if (hours == 0) {
      hours = 12;
    }
    
    if(showMinutes) {
      var minutes = date.getMinutes();
      if(minutes < 10) {
        minutes = '0'+minutes;
      }
      
      return hours + ':' + minutes + ' ' + meridian;
    }
    return hours + ' ' + meridian;
  },
  
  weekDayForDate: function(date) {
    return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"][date.getDay()];
  },
  
  ////////////////////////////////////////////////////////////////////////////////
  // Routing and associated helpers
  ////////////////////////////////////////////////////////////////////////////////
  showCity: function(id) {
    if(id) {
      $('body').removeClass().addClass('show-selected-city');
      this.selectedCityId = id;
      this.renderSelectedCity();
      this.getWeatherDataForCityId(this.cityDataForId(id), 'detail', true);
      this.renderNav();
    }
  },

  showList: function() {
    this.updateDataForCitiesList();
    this.renderCitiesList();
    $('body').removeClass().addClass('show-cities-list');
    this.renderNav();
  },

  parseRoute: function() {
    var hash = window.location.hash;
    this.selectedCityId = null;

    if (hash.indexOf('#city/') !== -1) {
      this.showCity(hash.split('#city/')[1]);
    } else {
      this.showList();
    }
  },
  
  ////////////////////////////////////////////////////////////////////////////////
  // Initialization
  ////////////////////////////////////////////////////////////////////////////////
  init: function() {

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(this.currentLocationWasUpdated, this.currentLocationWasDenied);
    }
    
    this.loadDataFromLocalStorage();

    var self = this;

    $(window).on('hashchange', function() {
      self.parseRoute();
    });

     
    self.parseRoute();
  
    setInterval(function() {
      self.parseRoute();
    }, self.timeUpdateInterval);
  
  }
};

$(window).ready(function() {
  Weather.init();
});
