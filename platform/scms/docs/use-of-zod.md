# Use of Zod

We are using [Zod](https://github.com/colinhacks/zod) and an extension called [zod-form-data](https://www.npmjs.com/package/zod-form-data) within the application.

So far we've used this very effectively in the API layer and we're using Zod there and Zod schemas to verify JSON bodies that we're
 receiving in POSTs, for example. You can also use Zod to handle the query params. In order to find out how we're using Zod in the API,
 look at the file in `app/api.schemas.ts` and search for uses of the `validate` function to see that in place. 
 
 Let's continue to use Zod heavily for any query parameters and JSON bodies that we are receiving on the API.

## Use of zod-form-data

Our usage of Zod to validate our forms in the app is not well established. 

We really want to promote consistency across the forms in our app and especially around our use of sort of fetchers within Remix. 
So let's use Zod and Zod form data everywhere we can in our app to achieve that consistency. 

We now have a helper function in place in the file `app/app.schemas.ts` and if you look at the `validateFormData()` and `withValidFormData` 
functions in there and search for uses of it, you'll see how that's currently being used. Check out `app/routes/app.sites.siteName.domains/route.ts` 
for an example of how to use these in place.

Let's continue to expand that pattern across all of our forms.