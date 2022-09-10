import gql from 'graphql-tag';

export const adminApiSchema = gql`

  type PresignedPost {
    url: String!
    fields: JSON!
  }

  extend type Mutation {
    createPresignedPost(filename: String): PresignedPost!
    createExistingAssets(input: [CreateExistingAssetInput!]!): [CreateAssetResult!]!
  }
  
  input CreateExistingAssetInput {
    filename: String!
    tags: [String!]
}

`;
