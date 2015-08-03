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

// Util
function _optVal(val) {
	return val ? val : '--';
}

function _metersToMiles(meters) {
	return meters / 1609.344;
}

// React
var Toolbar = React.createClass({
	render: function() {
		return <h1>Elevate</h1>;
	},
});
var DayCellList = React.createClass({
	mixins: [Backbone.React.Component.mixin],
	createDay: function(day) {
		var dateStr = moment(day.date).format('MMM D');
		var metersBiked = _.reduce(_.filter(day.activities, function(x) {
			return x.type === "Ride";
		}), function(acc, x) {
			return acc + x.distance;
		}, 0);
		return <DayCell date={dateStr}
			steps={_optVal(day.summary.steps)}
			calories={_optVal(day.summary.calories)}
			floors={_optVal(day.summary.floors)}
			heart={day.summary.heart ? day.summary.heart.restingHeartRate : '--'}
			activeTime={_optVal(day.summary.activeTime)}
			milesBiked={day.activities.length > 0 ? _metersToMiles(metersBiked).toFixed(1) : '--'} />
	},
	render: function() {
		return (
			<div className="dayCellList">
				{this.state.collection.map(this.createDay)}
			</div>
		)
	},
});
var DayCell = React.createClass({

	render: function() {
		return (
			<div className="dayCell">
				<div><b>{this.props.date}</b></div>
				<div>{this.props.steps} steps</div>
				<div>{this.props.calories} calories</div>
				<div>{this.props.floors} floors</div>
				<div>{this.props.heart} bpm resting</div>
				<div>{this.props.activeTime} active minutes</div>
				<div>{this.props.milesBiked} miles biked</div>
			</div>
		);
	},
});
React.render((
	<div>
		<Toolbar />
		<DayCellList collection={dayCollection} />
	</div>
), document.getElementById('elevate'));