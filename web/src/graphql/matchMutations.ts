// GraphQL mutations for match data entry

export const createPointMutation = `mutation CreatePoint($input: CreatePointInput!) {
  createPoint(input:$input) { id }
}`

export const createMatchMutation = `mutation CreateMatch($input: CreateMatchInput!) {
  createMatch(input:$input){
    id heldOn tournament isOfficial ourUniversityId opponentUniversityId videoUrl videoPlaylist
  }
}`

export const createBoutMutation = `mutation CreateBout($input: CreateBoutInput!) {
  createBout(input:$input){ id ourPlayerId opponentPlayerId }
}`

export const createPlayerMutation = `mutation CreatePlayer($input: CreatePlayerInput!) {
  createPlayer(input:$input){ id name universityId gender preferredStance }
}`

export const updateBoutMutation = `mutation UpdateBout($input: UpdateBoutInput!) {
  updateBout(input:$input){ id winType winnerPlayerId videoUrl videoTimestamp }
}`

export const updateMatchMutation = `mutation UpdateMatch($input: UpdateMatchInput!) {
  updateMatch(input:$input){ id videoUrl videoPlaylist }
}`

export const deletePointMutation = `mutation DeletePoint($input: DeletePointInput!) {
  deletePoint(input:$input){ id }
}`

export const deleteBoutMutation = `mutation DeleteBout($input: DeleteBoutInput!) {
  deleteBout(input:$input){ id }
}`

export const deleteMatchMutation = `mutation DeleteMatch($input: DeleteMatchInput!) {
  deleteMatch(input:$input){ id }
}`

export const createBoutAnalysisMutation = `mutation CreateBoutAnalysis($input: CreateBoutAnalysisInput!) {
  createBoutAnalysis(input:$input){
    id boutId category content importance tags recordedAt
  }
}`
