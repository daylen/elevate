# Elevate

Elevate is a personal fitness web dashboard that pulls in data from Fitbit, Jawbone, and Strava.

Elevate is self-hosted and open-source (see the License section), so you can get your own Elevate, or help improve it!

## Get your own Elevate

If you want to run your own instance of Elevate, you'll need a few things:

- A server that can run Node.js
- A MongoDB database
- Fitness data that you want to display from Fitbit, Jawbone, or Strava

You can satisfy the first two requirements by launching a Node.js droplet on DigitalOcean. If you don't have a DigitalOcean account, you can [sign up here](https://www.digitalocean.com/?refcode=9b20349390ec).

Assuming you have a server with Node and Mongo installed, here's what you have to do:

1. Clone this repo: `git clone https://github.com/daylen/elevate.git && cd elevate`
2. Install the dependencies: `npm install`
3. Install webpack: `npm install -g webpack`
4. Compile the front-end JS for production: `webpack -p`
5. Get some Fitbit, Jawbone, and Strava API keys:
	- Register a Fitbit app [here](https://dev.fitbit.com/apps/new). Set OAuth 1.0 type to Browser and OAuth 2.0 type to Server. Include your domain name in the callback URL field. Elevate only neads read access.
	- Register a Jawbone app [here](https://jawbone.com/up/developer/). Include your domain name in the OAuth Redirect URI field.
	- Register a Strava app [here](https://www.strava.com/developers). Include your domain in the Authorization Callback Domain field.
6. Edit the config file: `cp config/config.yml config/custom.yml && nano config/custom.yml`
	- Your name is displayed in the header of the dashboard.
	- [Here is a map](http://momentjs.com/timezone/) of valid timezone strings.
	- Pick a strong password; this is how you'll log in to the settings area.
	- Replace all the relevant OAuth fields.
7. Install naught: `npm install -g naught`
8. `npm start`
9. Visit `YOUR_DOMAIN_NAME/admin`, log in with the username and password you chose in `custom.yml`, and connect some accounts.
10. Visit `YOUR_DOMAIN_NAME`. You should see your health data! If not, please let me know and I'll do my best to help.

**Note**: It is strongly recommended that you serve your site over HTTPS because the settings area uses HTTP Basic Auth. Remember that [CloudFlare](https://www.cloudflare.com) offers free SSL.

## Hack on Elevate

Want to contribute to Elevate? This "how it works" will get you oriented.

### Back end

The back end is a Node app that polls for health data from Fitbit, Jawbone, and Strava every 2 minutes and stores that data in MongoDB. It then exposes that data through an internal API. Additionally, there is a settings area (`/admin`) that lets you connect and disconnect accounts. The first time an account is connected, Elevate will attempt to backfill as much data as possible. From then on, the polling will only update recent entries.

The code that crawls the various services can be found in `connectors/`. The API code can be found in `routes/api.js`. Or, you can just look at this cheat sheet:

- GET `/api/v1/name` - fetches the user's name
- GET `/api/v1/activity` - fetches the last month of activity
- GET `/api/v1/activity?from=2015-01-01&to=2015-02-01` - fetches a range of activity
- GET `/api/v1/activity/2015-01-01` - fetches activity for a specific day

Specify `NODE_ENV=dev` to disable background crawling.

### Front end

The front end is a [React](http://facebook.github.io/react/) app (with routing by [React Router](http://rackt.github.io/react-router/)), following the [Flux app architecture](https://facebook.github.io/flux/). Since I hacked this together over a couple of days, everything's in `public/jsx/app.jsx` and `public/less/app.less`.

#### Actions
- `loadName`
- `loadMoreDays` - Fired when you load the page for the first time, or when you hit the Load More button
- `loadSingleDay` - Fired when you load a detail page

#### Stores
- `DayStore`

#### Views
- `Toolbar`
- `DayCellList`
	- `DayCell`
	- `LoadMore`
- `DayDetail`
	- `ActivityNugget` - These are the Strava boxes
- `Footer`

## License

MIT license.
