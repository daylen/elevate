// Load css
require('../less/app.less');

// Load libraries
require('jquery');
var _ = require('underscore');
require('backbone');
var React = require('react');
require('backbone-react-component');
var moment = require('moment');

// Constants
var stepsGoal = 10000;
var caloriesGoal = 2400;
var floorsGoal = 15;
var activeTimeGoal = 30;

// Backbone models
var Day = Backbone.Model.extend({
	idAttribute: 'date',
});

var DayCollection = Backbone.Collection.extend({
	model: Day,
	url: '/api/v1/activity',
	parse: function(data) {
		this.next_url = data.next;
		return data.activities;
	},
	next_url: '',
	comparator: function(m1, m2) {
		return moment(m1.id).isBefore(m2.id) ? 1 : -1;
	},
});

// Model instantiation
var dayCollection = new DayCollection();
dayCollection.fetch().then(function() {
	console.log('fetched data');
	console.log(dayCollection.length + ' days');
});

// Utils
function _metersToMiles(meters) {
	return meters / 1609.344;
}

// React
var Toolbar = React.createClass({
	render: function() {
		return <div className="toolbar">
			<div className="content">
				<h1>elevate</h1>
			</div>
		</div>;
	},
});

var DayCellList = React.createClass({
	mixins: [Backbone.React.Component.mixin],
	createDay: function(day) {
		var dateStr = moment(day.date).format('MMM D');
		var weekdayStr = moment(day.date).format('ddd');
		var metersBiked = _.reduce(_.filter(day.activities, function(x) {
			return x.type === "Ride";
		}), function(acc, x) {
			return acc + x.distance;
		}, 0);
		return <DayCell date={dateStr}
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
				{this.state.collection.map(this.createDay)}
			</div>
		)
	},
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
			<div className="day">
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
			</div>
		);
	},
});

var LoadMore = React.createClass({
	handleClick: function() {
		dayCollection.fetch({remove: false, url: dayCollection.next_url });
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
})

React.render((
	<div>
		<Toolbar />
		<div className="content">
			<DayCellList collection={dayCollection} />
			<LoadMore />
		</div>
	</div>
), document.getElementById('elevate'));
