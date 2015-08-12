require('../less/app.less');

import Fluxxor from 'fluxxor';
import React from 'react';
import moment from 'moment';
import $ from 'jquery';

var Router = require('react-router');
var Route = Router.Route;
var DefaultRoute = Router.DefaultRoute;
var Link = Router.Link;

let stepsGoal = 10000;
let caloriesGoal = 2400;
let floorsGoal = 15;
let activeTimeGoal = 30;

var constants = {
	LOAD_MORE_DAYS: "LOAD_MORE_DAYS",
	LOAD_MORE_DAYS_SUCCESS: "LOAD_MORE_DAYS_SUCCESS",
	LOAD_MORE_DAYS_FAIL: "LOAD_MORE_DAYS_FAIL",

	LOAD_SINGLE_DAY: "LOAD_SINGLE_DAY",
	LOAD_SINGLE_DAY_SUCCESS: "LOAD_SINGLE_DAY_SUCCESS",
	LOAD_SINGLE_DAY_FAIL: "LOAD_SINGLE_DAY_FAIL"
};

var actions = {
	loadMoreDays: function(url) {
		this.dispatch(constants.LOAD_MORE_DAYS);

		$.ajax({
			url: url,
			success: (data) => {
				this.dispatch(constants.LOAD_MORE_DAYS_SUCCESS, data);
			},
			error: () => {
				this.dispatch(constants.LOAD_MORE_DAYS_FAIL);
			},
		});
	},

	loadSingleDay: function(id) {
		this.dispatch(constants.LOAD_SINGLE_DAY);

		$.ajax({
			url: '/api/v1/activity/' + id,
			success: (data) => {
				this.dispatch(constants.LOAD_SINGLE_DAY_SUCCESS, data);
			},
			error: () => {
				this.dispatch(constants.LOAD_SINGLE_DAY_FAIL);
			},
		});
	},
};

var DayStore = Fluxxor.createStore({
	initialize: function() {
		this.loading = false;
		this.dayMap = new Map();
		this.next_url = "/api/v1/activity";

		this.bindActions(
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
		return [...this.dayMap.values()].sort((m1, m2) =>
			moment(m1.date).isBefore(m2.date) ? 1 : -1);
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
	render: function() {
		return <div className="toolbar">
			<div className="content">
				<h1><Link to="/">elevate</Link></h1>
			</div>
		</div>;
	},
});

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
		var metersBiked = day.activities.filter(r => r.type === "Ride")
			.map(r => r.distance)
			.reduce((a, b) => a + b, 0);
		return <DayCell id={dateId}
			date={dateStr}
			weekday={weekdayStr}
			steps={'steps' in day.summary
				? day.summary.steps
				: '--'}
			calories={'calories' in day.summary
				? day.summary.calories.toFixed(0)
				: '--'}
			floors={'floors' in day.summary
				? day.summary.floors
				: '--'}
			heart={day.summary.heart
				? (day.summary.heart.restingHeartRate || '--')
				: '--'}
			activeTime={'activeTime' in day.summary
				? day.summary.activeTime.toFixed(0)
				: '--'}
			milesBiked={day.activities.length > 0
				? _metersToMiles(metersBiked).toFixed(1)
				: 0} />
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
	render: function() {
		return <h1>{this.state.day ? this.state.day.date : '...'}</h1>;
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

flux.actions.loadMoreDays(stores.DayStore.next_url);