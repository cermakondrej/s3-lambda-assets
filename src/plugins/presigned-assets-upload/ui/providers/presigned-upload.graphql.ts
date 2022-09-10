import gql from 'graphql-tag';

export const ASSET_FRAGMENT = gql`
  fragment Asset on Asset {
    id
    createdAt
    updatedAt
    name
    fileSize
    mimeType
    type
    preview
    source
    width
    height
    focalPoint {
      x
      y
    }
  }
`;

export const TAG_FRAGMENT = gql`
  fragment Tag on Tag {
    id
    value
  }
`;

export const CREATE_PRESIGNED_POST = gql`
    mutation CreatePresignedPost($filename: String!) {
         createPresignedPost(filename: $filename) {
            url
            fields
        }
    }
    
`;

export const CREATE_EXISTING_ASSETS = gql`
    mutation CreateExistingAssets($input: [CreateExistingAssetInput!]!) {
        createExistingAssets(input: $input) {
            ...Asset
            ... on Asset {
                tags {
                    ...Tag
                }
            }
            ... on ErrorResult {
                message
            }
        }
    }
    ${ASSET_FRAGMENT}
    ${TAG_FRAGMENT}
`;

