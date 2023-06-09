import {defer} from '@shopify/remix-oxygen';
import {flattenConnection} from '@shopify/hydrogen';
import {Await, Form, useLoaderData} from '@remix-run/react';
import {Suspense} from 'react';
import invariant from 'tiny-invariant';
import {
  Heading,
  Input,
  PageHeader,
  ProductGrid,
  ProductSwimlane,
  FeaturedCollections,
  Section,
  Text,
} from '~/components';
import {PRODUCT_CARD_FRAGMENT} from '~/data/fragments';
import {PAGINATION_SIZE} from '~/lib/const';

export default function () {
  const {searchTerm, products, noResultRecommendations} = useLoaderData();
  const noResults = products?.nodes?.length === 0;

  return (
    <>
      <div className="product-collections-sec pb-10 container pt-10 block mx-auto">
      <PageHeader>
        <Heading as="h1" size="copy">
          Search
        </Heading>
        <Form method="get" className="relative flex w-full text-heading">
          <Input
            defaultValue={searchTerm}
            placeholder="Search…"
            type="search"
            variant="search"
            name="q"
          />
          <button className="absolute right-0 py-2" type="submit">
            Go
          </button>
        </Form>
      </PageHeader>
      {!searchTerm || noResults ? (
        <>
          {noResults && (
            <Section padding="x">
              <Text className="opacity-50">
                No results, try something else.
              </Text>
            </Section>
          )}
          <Suspense>
            <Await
              errorElement="There was a problem loading related products"
              resolve={noResultRecommendations}
            >
              {(data) => (
                <>
                  <FeaturedCollections
                    title="Trending Collections"
                    collections={data.featuredCollections}
                  />
                  <ProductSwimlane
                    title="Trending Products"
                    products={data.featuredProducts}
                  />
                </>
              )}
            </Await>
          </Suspense>
        </>
      ) : (
          <Section>
            <div data-test="product-grid" className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                <ProductGrid
                  key="search"
                  url={`/search?q=${searchTerm}`}
                  collection={{products}}
                />
            </div>
          </Section>
        
      )}
      </div>
    </>
  );
}

export async function loader({request, context: {storefront}}) {
  const searchParams = new URL(request.url).searchParams;
  const cursor = searchParams.get('cursor');
  const searchTerm = searchParams.get('q');


  const data = await storefront.query(SEARCH_QUERY, {
    variables: {
      pageBy: PAGINATION_SIZE,
      searchTerm,
      cursor,
      country: storefront.i18n.country,
      language: storefront.i18n.language,
    },
  });

  invariant(data, 'No data returned from Shopify API');
  const {products} = data;

  const getRecommendations = !searchTerm || products?.nodes?.length === 0;

  return defer({
    searchTerm,
    products,
    noResultRecommendations: getRecommendations
      ? getNoResultRecommendations(storefront)
      : Promise.resolve(null),
  });
}

const SEARCH_QUERY = `#graphql
  ${PRODUCT_CARD_FRAGMENT}
  query search(
    $searchTerm: String
    $country: CountryCode
    $language: LanguageCode
    $pageBy: Int!
    $after: String
  ) @inContext(country: $country, language: $language) {
    products(
      first: $pageBy
      sortKey: RELEVANCE
      query: $searchTerm
      after: $after
    ) {
      nodes {
        ...ProductCard
      }
      pageInfo {
        startCursor
        endCursor
        hasNextPage
        hasPreviousPage
      }
    }
  }
`;

export async function getNoResultRecommendations(storefront) {
  const data = await storefront.query(SEARCH_NO_RESULTS_QUERY, {
    variables: {
      pageBy: PAGINATION_SIZE,
      country: storefront.i18n.country,
      language: storefront.i18n.language,
    },
  });

  invariant(data, 'No data returned from Shopify API');

  return {
    featuredCollections: flattenConnection(data.featuredCollections),
    featuredProducts: flattenConnection(data.featuredProducts),
  };
}

const SEARCH_NO_RESULTS_QUERY = `#graphql
  ${PRODUCT_CARD_FRAGMENT}
  query searchNoResult(
    $country: CountryCode
    $language: LanguageCode
    $pageBy: Int!
  ) @inContext(country: $country, language: $language) {
    featuredCollections: collections(first: 3, sortKey: UPDATED_AT) {
      nodes {
        id
        title
        handle
        image {
          altText
          width
          height
          url
        }
      }
    }
    featuredProducts: products(first: $pageBy) {
      nodes {
        ...ProductCard
      }
    }
  }
`;
