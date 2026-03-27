import { getFileSummaries } from "../db/queries.js";
import logger from "../utils/logger.js";

function extractReatedFiles(filename, allFiles) {
    const folder = filename.split("/").silce(0,-1).join("/");
const related = allFiles
                .filter((f)=> f.filename!==filename)
                .filter((f)=>{
                  const sameFolder = f.filename.startsWith(folder)
                  const sameFile = f.filename.includes(filename.split("/").pop().replace(/\.[^.]+$/, ''))
                  return sameFolder || sameFile;
                })
                .map((f)=>f.filename).slice(0,5);

    return related;
}

export const getRAGContext = async({repo, filename, allFiles})=>{
    const relatedFilesNames =  extractReatedFiles(filename, allFiles);

    if(relatedFilesNames.length === 0){
        return null;
    }

    const summary = await getFileSummaries({repo, filenames:relatedFilesNames});

    if(summary.length === 0){
        return null;
    }

    const context = summary
                    .map((s)=>`File:${s.filename}\nSummary:${s.summary}`)
                    .join("\n\n");
    logger.info("RAG context generated", { repo, filename, relatedFilesCount: summary.length });

    return context;
}