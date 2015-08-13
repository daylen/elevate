require('../less/app.less');

import Fluxxor from 'fluxxor';
import React from 'react';
import moment from 'moment';

require("babel/polyfill");
var Router = require('react-router');
var Route = Router.Route;
var DefaultRoute = Router.DefaultRoute;
var Link = Router.Link;

let stepsGoal = 10000;
let distanceGoal = 5;
let caloriesGoal = 2400;
let floorsGoal = 15;
let activeTimeGoal = 30;

var constants = {
	LOAD_NAME: "LOAD_NAME",
	LOAD_NAME_SUCCESS: "LOAD_NAME_SUCCESS",
	LOAD_NAME_FAIL: "LOAD_NAME_FAIL",

	LOAD_MORE_DAYS: "LOAD_MORE_DAYS",
	LOAD_MORE_DAYS_SUCCESS: "LOAD_MORE_DAYS_SUCCESS",
	LOAD_MORE_DAYS_FAIL: "LOAD_MORE_DAYS_FAIL",

	LOAD_SINGLE_DAY: "LOAD_SINGLE_DAY",
	LOAD_SINGLE_DAY_SUCCESS: "LOAD_SINGLE_DAY_SUCCESS",
	LOAD_SINGLE_DAY_FAIL: "LOAD_SINGLE_DAY_FAIL"
};

function _httpGet(url, success, failure) {
	var xhr = new XMLHttpRequest();
	xhr.open('GET', encodeURI(url));
	xhr.onload = function() {
		if (xhr.status === 200) {
			success(JSON.parse(xhr.responseText));
		} else {
			failure();
		}
	};
	xhr.send();
}

var actions = {
	loadName: function() {
		this.dispatch(constants.LOAD_NAME);

		_httpGet('api/v1/name', (data) => {
			this.dispatch(constants.LOAD_NAME_SUCCESS, data);
		}, () => {
			this.dispatch(constants.LOAD_NAME_FAIL);
		});
	},

	loadMoreDays: function(url) {
		this.dispatch(constants.LOAD_MORE_DAYS);

		_httpGet(url, (data) => {
			this.dispatch(constants.LOAD_MORE_DAYS_SUCCESS, data);
		}, () => {
			this.dispatch(constants.LOAD_MORE_DAYS_FAIL);
		});
	},

	loadSingleDay: function(id) {
		this.dispatch(constants.LOAD_SINGLE_DAY);

		_httpGet('/api/v1/activity/' + id, (data) => {
			this.dispatch(constants.LOAD_SINGLE_DAY_SUCCESS, data);
		}, () => {
			this.dispatch(constants.LOAD_SINGLE_DAY_FAIL);
		});
	},
};

var DayStore = Fluxxor.createStore({
	initialize: function() {
		this.name = "";
		this.loading = false;
		this.dayMap = new Map();
		this.next_url = "/api/v1/activity";

		this.bindActions(
			constants.LOAD_NAME_SUCCESS, this.onLoadNameSuccess,
			constants.LOAD_MORE_DAYS, this.onLoadMoreDays,
			constants.LOAD_MORE_DAYS_SUCCESS, this.onLoadMoreDaysSuccess,
			constants.LOAD_MORE_DAYS_FAIL, this.onLoadMoreDaysFail,
			constants.LOAD_SINGLE_DAY, this.onLoadSingleDay,
			constants.LOAD_SINGLE_DAY_SUCCESS, this.onLoadSingleDaySuccess,
			constants.LOAD_SINGLE_DAY_FAIL, this.onLoadSingleDayFail
		);
	},
	getDay: function(dateStr) {
		return this.dayMap.get(dateStr);
	},
	getDays: function() {
		return Array.from(this.dayMap.values()).sort((m1, m2) =>
			moment(m1.date).isBefore(m2.date) ? 1 : -1);
	},
	onLoadNameSuccess: function(data) {
		this.name = data.name;
	},
	onLoadMoreDays: function() {
		this.loading = true;
		this.emit('change');
	},
	onLoadMoreDaysSuccess: function(data) {
		this.loading = false;
		for (var day of data.activities) {
			this.dayMap.set(day.date, day);
		}
		this.next_url = data.next;
		this.emit('change');
	},
	onLoadMoreDaysFail: function() {
		this.loading = false;
		console.log('Error loading more days');
		this.emit('change');
	},
	onLoadSingleDay: function() {
		this.loading = true;
		this.emit('change');
	},
	onLoadSingleDaySuccess: function(data) {
		this.loading = false;
		this.dayMap.set(data.date, data);
		this.emit('change');
	},
	onLoadSingleDayFail: function() {
		this.loading = false;
		console.log('Error loading single day');
		this.emit('change');
	},
});

var stores = {
	DayStore: new DayStore()
};

var flux = new Fluxxor.Flux(stores, actions);

flux.on('dispatch', function(type, payload) {
	console.log('Dispatch', type, payload);
});

var FluxMixin = Fluxxor.FluxMixin(React),
	StoreWatchMixin = Fluxxor.StoreWatchMixin;

function _metersToMiles(meters) {
	return meters / 1609.344;
}

var Toolbar = React.createClass({
	mixins: [FluxMixin, StoreWatchMixin('DayStore')],
	getStateFromFlux: function() {
		var store = this.getFlux().store('DayStore');
		return {
			name: store.name
		};
	},
	render: function() {
		return <div className="toolbar">
			<div className="content">
				<h1><Link to="/">{this.state.name}</Link></h1>
			</div>
		</div>;
	},
});

function _getNormalizedSummary(summary) {
	// Returns a normalized summary, ready for presentation.
	// Empty fields have '--'
	if (!summary) return {};

	// We don't use the || hack to distinguish between missing and zero values
	return {
		steps: 'steps' in summary
			? summary.steps
			: '--',
		calories: 'calories' in summary
			? summary.calories.toFixed(0)
			: '--',
		floors: 'floors' in summary
			? summary.floors
			: '--',
		heart: summary.heart
			? (summary.heart.restingHeartRate || '--')
			: '--',
		activeTime: 'activeTime' in summary
			? summary.activeTime.toFixed(0)
			: '--',
		distance: 'distance' in summary
			? _metersToMiles(summary.distance * 1000).toFixed(1)
			: '--'
	};
}

var DayCellList = React.createClass({
	mixins: [FluxMixin, StoreWatchMixin('DayStore')],
	getStateFromFlux: function() {
		var store = this.getFlux().store('DayStore');
		return {
			days: store.getDays()
		};
	},
	createDay: function(day) {
		var dateId = moment(day.date).format('YYYY-MM-DD');
		var dateStr = moment(day.date).format('MMM D');
		var weekdayStr = moment(day.date).format('ddd');

		var milesBiked = day.activities.length
			? _metersToMiles(day.activities
				.filter(r => r.type === "Ride")
				.map(r => r.distance)
				.reduce((a, b) => a + b, 0)).toFixed(1)
			: 0;

		var norm = _getNormalizedSummary(day.summary);

		return <DayCell id={dateId}
			date={dateStr}
			weekday={weekdayStr}
			steps={norm.steps}
			calories={norm.calories}
			floors={norm.floors}
			heart={norm.heart}
			activeTime={norm.activeTime}
			milesBiked={milesBiked} />
	},
	render: function() {
		return (
			<div>
				{this.state.days.map(this.createDay)}
				<LoadMore />
			</div>
		);
	}
});

function _getStyleForMeasurement(measurement, goal) {
	if (measurement == '--') {
		return 'noValue';
	} else if (measurement < goal / 2) {
		return 'lowValue';
	} else if (measurement < goal) {
		return 'mediumValue';
	} else {
		return 'highValue';
	}
}

function _getStyleForHeartRate(heartRate) {
	if (heartRate == '--') {
		return 'noValue';
	} else if (heartRate < 60) {
		return 'highValue';
	} else if (heartRate < 80) {
		return 'mediumValue';
	} else {
		return 'lowValue';
	}
}

var DayCell = React.createClass({
	render: function() {
		var stepsStyle = _getStyleForMeasurement(this.props.steps, stepsGoal);
		var caloriesStyle = _getStyleForMeasurement(this.props.calories, caloriesGoal);
		var floorsStyle = _getStyleForMeasurement(this.props.floors, floorsGoal);
		var heartStyle = _getStyleForHeartRate(this.props.heart);
		var activeTimeStyle = _getStyleForMeasurement(this.props.activeTime, activeTimeGoal);
		var milesBikedStyle = this.props.milesBiked == 0
			? 'noValue'
			: '';

		return (
			<Link to="detail" params={{id: this.props.id}} className="day">
				<div className="nugget">
					<div className="">{this.props.date}</div>
					<div className="label">{this.props.weekday}</div>
				</div>
				<div className="nugget">
					<div className={stepsStyle}>{this.props.steps}</div>
					<div className="label">steps</div>
				</div>
				<div className="nugget secondary">
					<div className={caloriesStyle}>{this.props.calories}</div>
					<div className="label">calories burned</div>
				</div>
				<div className="nugget secondary">
					<div className={floorsStyle}>{this.props.floors}</div>
					<div className="label">floors</div>
				</div>
				<div className="nugget">
					<div className={heartStyle}>{this.props.heart}</div>
					<div className="label">bpm resting</div>
				</div>
				<div className="nugget">
					<div className={activeTimeStyle}>{this.props.activeTime}</div>
					<div className="label">active minutes</div>
				</div>
				<div className="nugget">
					<div className={milesBikedStyle}>{this.props.milesBiked}</div>
					<div className="label">miles biked</div>
				</div>
			</Link>
		);
	},
});

var LoadMore = React.createClass({
	mixins: [FluxMixin],
	handleClick: function() {
		var store = this.getFlux().store('DayStore');
		this.getFlux().actions.loadMoreDays(store.next_url);
	},
	render: function() {
		return (
			<div className="loadMoreOuter">
				<span onClick={this.handleClick} className="loadMore">
					Load More...
				</span>
			</div>
		);
	}
});

var DayDetail = React.createClass({
	mixins: [FluxMixin, StoreWatchMixin('DayStore')],
	getStateFromFlux: function() {
		var store = this.getFlux().store('DayStore');
		var dateStr = this.props.params.id;
		var obj = store.getDay(dateStr);
		if (!obj && !store.loading) {
			this.getFlux().actions.loadSingleDay(dateStr);
		}
		return {
			day: obj
		};
	},
	createActivityNugget: function(activity) {
		return (
			<ActivityNugget activity={activity}/>
		);
	},
	render: function() {
		if (!this.state.day) {
			return <div>Loading...</div>;
		}
		var norm = _getNormalizedSummary(this.state.day.summary);

		var stepsStyle = _getStyleForMeasurement(norm.steps, stepsGoal);
		var distanceStyle = _getStyleForMeasurement(norm.distance, distanceGoal);
		var caloriesStyle = _getStyleForMeasurement(norm.calories, caloriesGoal);
		var floorsStyle = _getStyleForMeasurement(norm.floors, floorsGoal);
		var heartStyle = _getStyleForHeartRate(norm.heart);
		var activeTimeStyle = _getStyleForMeasurement(norm.activeTime, activeTimeGoal);
		return (
			<div className="detail">
				<h1>{moment(this.state.day.date).format('ddd, MMM D, YYYY')}</h1>
				<div className="column">
					<h2>Summary</h2>
					<div className="nugget">
						<div className={stepsStyle}>{norm.steps}</div>
						<div className="label">steps</div>
					</div>
					<div className="nugget">
						<div className={distanceStyle}>{norm.distance}</div>
						<div className="label">miles</div>
					</div>
					<div className="nugget">
						<div className={caloriesStyle}>{norm.calories}</div>
						<div className="label">calories burned</div>
					</div>
					<div className="nugget">
						<div className={floorsStyle}>{norm.floors}</div>
						<div className="label">floors</div>
					</div>
					<div className="nugget">
						<div className={heartStyle}>{norm.heart}</div>
						<div className="label">bpm resting</div>
					</div>
					<div className="nugget">
						<div className={activeTimeStyle}>{norm.activeTime}</div>
						<div className="label">active minutes</div>
					</div>
				</div>
				<div className="column">
					<h2>Activities</h2>
					{this.state.day.activities.length
						? this.state.day.activities.map(this.createActivityNugget)
						: <div className="placeholder">No activities</div>}
				</div>
			</div>
		);
	}
});

function _metersToFeet(meters) {
	return meters * 3.28084;
}

var ActivityNugget = React.createClass({
	render: function() {
		var activity = this.props.activity;
		var movingTime = moment.duration(activity.moving_time, 'seconds');

		return (
			<div className="activity">
				<h3>{activity.name}</h3>
				<div className="activityType"><b>{activity.type}</b>Started {moment(activity.start_date).format('h:mm A')}</div>
				<div className="activityNuggetGrid">
					<div className="activityNugget">
						<div>{_metersToMiles(activity.distance).toFixed(1)}<small>mi</small></div>
						<div className="label">Distance</div>
					</div>
					<div className="activityNugget">
						<div>{_metersToFeet(activity.total_elevation_gain).toFixed(0)}<small>ft</small></div>
						<div className="label">Elevation</div>
					</div>
					<div className="activityNugget">
						<div>{movingTime.hours()}<small>h</small> {movingTime.minutes()}<small>m</small></div>
						<div className="label">Moving Time</div>
					</div>
					<div className="activityNugget">
						<div>{_metersToMiles(activity.average_speed * 3600).toFixed(1)}<small>mi/h</small></div>
						<div className="label">Average Speed</div>
					</div>
				</div>

				{activity.private
					? <a className="button disabled">Activity is private</a>
					: <a href={"http://strava.com/activities/" + activity.id}
						target="_blank" className="button">Map on Strava »</a>}
			</div>
		);
	}
});

var Footer = React.createClass({
	render: function() {
		return (
			<footer>
				<div className="content">
					<p><a href="https://github.com/daylen/elevate" target="_blank">Powered by Elevate</a>.</p>
				</div>
			</footer>
		);
	}
});

var RouteHandler = Router.RouteHandler;

var App = React.createClass({
	mixins: [FluxMixin],
	render: function() {
		return (
			<div>
				<Toolbar />
				<div className="content">
					<RouteHandler/>
				</div>
				<Footer />
			</div>
		);
	}
});

var routes = (
	<Route handler={App} path="/">
		<DefaultRoute handler={DayCellList}/>
		<Route name="detail" path="detail/:id" handler={DayDetail}/>
	</Route>
);

var appElement = document.getElementById('elevate');

Router.run(routes, function(Handler) {
	React.render(<Handler flux={flux} />, appElement);
});

flux.actions.loadName();
flux.actions.loadMoreDays(stores.DayStore.next_url);
